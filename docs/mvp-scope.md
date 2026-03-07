# HireMePlz MVP Scope Freeze

This project currently prioritizes only three core tracks to avoid scope creep:

## 1. Profile Management

- User registration, sign-in, and authentication
- Core profile maintenance
- Education and project/internship experience management
- Story library management for long-form answer generation

## 2. Smart Autofill

- Chrome extension scans page fields
- Structured field matching: name, email, phone, school, degree, links, visa status, etc.
- Open-ended answer suggestions generated from story library
- User confirms suggestions before filling fields (no auto-submit)

## 3. Application Tracking

- Automatically save each autofill session
- View application history
- Manually update application status

## Deferred Items

The following capabilities keep basic structure and interfaces, but are not first-priority acceptance goals:

- Multi-source job fetching
- Advanced job recommendation ranking
- Email notifications
- Production-grade Docker Swarm deployment
- Full monitoring stack

## Technical Boundaries

- Prioritize Greenhouse and standard HTML forms first
- Open-ended generation defaults to local template logic; configure `OPENAI_API_KEY` to switch to real model calls
- Extension is content-script oriented and does not implement complex popup-based UX
