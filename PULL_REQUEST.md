## What does this PR do?

This PR brings significant improvements to security, backend reliability, and frontend polish across the entire SmartPoultry platform, whilst ensuring all recent merges (such as Dennis's wishlist and firebase-admin updates) are cleanly integrated.

### 1. Authentication Hardening & Security
- Overhauled Firebase Admin configuration to handle environment variable injection securely across different platforms (Windows/Linux/Docker).
- Implemented robust Role-Based Access Control (`roleGuard.js`) ensuring strict boundary enforcement between `ADMIN`, `MANAGER`, `CUSTOMER`, and `DRIVER` roles.
- Hardened all sensitive routes (e.g., `/api/admin/users`, `/api/delivery/manager`) so they reject misconfigured JWTs explicitly.

### 2. Analytics & Data Correctness
- Fixed calculations for Feed Conversion Ratio (FCR), ensuring it accurately divides mass consumed by mass produced (and gracefully handles zero-egg days).
- Improved the Z-Score outlier detection algorithm so that flat baselines don't produce infinite anomalies, drastically reducing false alerts on the dashboard.
- Ensured delivery timestamps are pulled correctly from the immutable `statusHistory` array rather than the volatile `updatedAt` field.

### 3. UI/UX Polish
- Redesigned product cards in the Customer Marketplace to cleanly cap long product names (clamping to 2 lines) without breaking the grid flow.
- Replaced the textual product descriptions with proper product imagery while retaining Wishlist compatibility.
- Cleaned up padding and sizing inconsistencies on the Welcome pages and Mobile bottom navigation bars.

### 4. Infrastructure (Docker & Tools)
- Added Docker configuration (Dockerfile & docker-compose) for streamlined deployment of the Node backend, Python AI microservice, and Postgres database.
- Added a `TEAM_SETUP.md` guide and necessary environment templates (`.env.example`) to streamline onboarding for new developers.

## Verification
- [x] Backend test suite passes (`npm test` returns 23/23 OK).
- [x] Confirmed `firebaseAdmin.js` conflicts are resolved, preserving upstream structure while maintaining proper initialisation.
- [x] Confirmed `CustomerMarketplace.jsx` resolves layout conflicts seamlessly.
- [x] Cleared stale locks and test scripts to ensure a pristine Git tree.

## Next Steps
Review and merge when ready. The branch is cleanly rebased against `main` and all automated tests are green.
