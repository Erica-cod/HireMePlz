"use client";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-4">HireMePlz</h1>
      <p className="text-xl text-gray-600 mb-8 text-center max-w-xl">
        Intelligent job application autofill. Fill out your profile once,
        autofill every application with one click.
      </p>
      <div className="flex gap-4">
        <a
          href="/auth"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
        >
          Get Started
        </a>
        <a
          href="/dashboard"
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-100 transition"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
