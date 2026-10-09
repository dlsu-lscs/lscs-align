# ADR 0004: Service Tier Classification

**Status:** Accepted

Align starts as Tier 2 because it is a persistent student/officer-facing production system. Upgrade to Tier 3 if it becomes event-critical, handles sensitive identity data, performs scarce one-time actions, or develops material capacity risk. Tier 3 triggers require concurrency, recovery, observability, and staffing controls to be reassessed before the new use launches.
