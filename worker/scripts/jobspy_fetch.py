from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


REPO_ROOT = Path(__file__).resolve().parents[2]
VENDOR_JOBSPY_PATH = REPO_ROOT / "vendor-jobspy"

if VENDOR_JOBSPY_PATH.exists():
    sys.path.insert(0, str(VENDOR_JOBSPY_PATH))

try:
    from jobspy import scrape_jobs
except ImportError as error:
    raise SystemExit(
        "无法导入 JobSpy。请先在项目根目录执行 `python -m pip install -e ./vendor-jobspy` 安装依赖。"
    ) from error


def read_payload() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("未收到 JobSpy 输入参数。")
    return json.loads(raw)


def as_clean_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    cleaned: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        normalized = value.strip()
        if normalized:
            cleaned.append(normalized)
    return cleaned


def build_google_search_term(keyword: str, location: str | None, is_remote: bool | None) -> str:
    parts = [keyword.strip(), "jobs"]
    if is_remote:
        parts.append("remote")
    elif location:
        parts.extend(["near", location.strip()])
    return " ".join(parts).strip()


def parse_location(location_text: str | None) -> dict[str, str | None] | None:
    if not location_text:
        return None

    parts = [part.strip() for part in location_text.split(",") if part.strip()]
    if not parts:
        return None
    if len(parts) == 1:
        return {"city": parts[0], "state": None, "country": None}
    if len(parts) == 2:
        return {"city": parts[0], "state": parts[1], "country": None}
    return {"city": parts[0], "state": parts[1], "country": parts[-1]}


def sanitize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    try:
        import pandas as pd  # 延迟导入，避免这里只为类型报错

        if pd.isna(value):
            return None
    except Exception:
        pass
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return value


def row_to_job(row: dict[str, Any]) -> dict[str, Any]:
    sanitized = {key: sanitize_value(value) for key, value in row.items()}
    location_text = sanitized.get("location")
    skills_value = sanitized.get("skills")
    if isinstance(skills_value, str):
        skills = [item.strip() for item in skills_value.split(",") if item.strip()]
    elif isinstance(skills_value, list):
        skills = [str(item).strip() for item in skills_value if str(item).strip()]
    else:
        skills = []

    return {
        "externalId": sanitized.get("id"),
        "site": sanitized.get("site"),
        "title": sanitized.get("title"),
        "company": sanitized.get("company"),
        "companyUrl": sanitized.get("company_url") or sanitized.get("company_url_direct"),
        "jobUrl": sanitized.get("job_url_direct") or sanitized.get("job_url"),
        "description": sanitized.get("description"),
        "skills": skills,
        "isRemote": sanitized.get("is_remote"),
        "jobType": sanitized.get("job_type"),
        "jobLevel": sanitized.get("job_level"),
        "postedAt": sanitized.get("date_posted"),
        "locationText": location_text,
        "location": parse_location(location_text),
        "salary": {
            "minAmount": sanitized.get("min_amount"),
            "maxAmount": sanitized.get("max_amount"),
            "currency": sanitized.get("currency"),
            "interval": sanitized.get("interval"),
        },
        "rawPayload": sanitized,
    }


def dedupe_jobs(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[tuple[str | None, str | None], dict[str, Any]] = {}
    for job in jobs:
        key = (job.get("site"), job.get("jobUrl"))
        deduped[key] = job
    return list(deduped.values())


def fetch_once(payload: dict[str, Any], location: str | None, job_type: str | None, results_wanted: int):
    sites = as_clean_list(payload.get("sites"))
    keyword = str(payload.get("keyword", "")).strip()
    country_indeed = str(payload.get("countryIndeed") or "USA").strip()
    hours_old = payload.get("hoursOld")
    is_remote = payload.get("isRemote")

    google_search_term = build_google_search_term(keyword, location, is_remote) if "google" in sites else None

    return scrape_jobs(
        site_name=sites,
        search_term=keyword,
        google_search_term=google_search_term,
        location=location,
        results_wanted=results_wanted,
        hours_old=hours_old,
        country_indeed=country_indeed,
        is_remote=bool(is_remote),
        job_type=job_type,
        description_format="markdown",
        linkedin_fetch_description=True,
        verbose=0,
    )


def main() -> int:
    payload = read_payload()
    keyword = str(payload.get("keyword", "")).strip()
    if not keyword:
        raise ValueError("缺少 keyword，无法调用 JobSpy。")

    locations = as_clean_list(payload.get("locations")) or [None]
    job_types = as_clean_list(payload.get("jobTypes")) or [None]
    results_wanted = int(payload.get("resultsWanted") or 20)
    combinations = max(1, len(locations) * len(job_types))
    per_query_limit = max(1, math.ceil(results_wanted / combinations))

    all_jobs: list[dict[str, Any]] = []
    query_runs: list[dict[str, Any]] = []
    errors: list[dict[str, str | None]] = []

    for location in locations:
        for job_type in job_types:
            try:
                dataframe = fetch_once(payload, location, job_type, per_query_limit)
                records = dataframe.to_dict(orient="records")
                jobs = [row_to_job(record) for record in records]
                all_jobs.extend(jobs)
                query_runs.append(
                    {
                        "location": location,
                        "jobType": job_type,
                        "fetchedCount": len(jobs),
                    }
                )
            except Exception as error:  # noqa: BLE001
                errors.append(
                    {
                        "location": location,
                        "jobType": job_type,
                        "message": str(error),
                    }
                )

    deduped_jobs = dedupe_jobs(all_jobs)

    if not deduped_jobs and errors:
        raise RuntimeError(json.dumps({"errors": errors}, ensure_ascii=False))

    response = {
        "jobs": deduped_jobs,
        "meta": {
            "queryRuns": query_runs,
            "errors": errors,
        },
    }
    sys.stdout.write(json.dumps(response, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
