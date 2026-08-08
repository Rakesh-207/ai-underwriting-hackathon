# Fairness Evaluation

Deterministic, audit-only fairness diagnostics for `@underwriting/engine`.
Every generated result is **synthetic**, **evaluation-only**, and **not a lending
decision**. The package does not produce an individual action or recommendation.

## Methodology

`createSyntheticAuditCohorts()` creates three deterministic synthetic groups.
Each applicant has an explicit `auditGroup` label and optional audit metadata.
The evaluator reconstructs a scoring input from scoring fields before calling
the engine. Audit labels, protected traits, and proxy metadata never enter the
engine input. The evaluator does not infer protected traits from names,
addresses, education, employers, institutions, occupations, or any other
applicant input.

`evaluateFairness()` scores each applicant twice:

1. With the applicant's optional consented alternative signals, if present.
2. With all optional signals removed, retaining the same baseline application.

The report compares those two views by synthetic group. Refusing an optional
source therefore has no separate penalty: the same applicant's baseline score
is the comparison point.

## Metrics And Formulas

- Score mean: `sum(dynamic scores) / group sample size`.
- Score median: middle ordered dynamic score, or the midpoint of the two middle scores.
- Score gap: `group dynamic-score mean - reference-group dynamic-score mean`.
- Illustrative diagnostic threshold rate: `count(dynamic score >= 650) / group sample size`.
- Adverse-impact ratio: `group threshold rate / reference-group threshold rate`.

The default synthetic diagnostic thresholds are:

- Minimum group size: `10`.
- Maximum absolute mean-score gap: `50` score points.
- Minimum adverse-impact ratio: `0.80`.

All thresholds are configurable. The adverse-impact ratio is an illustrative
four-fifths screening diagnostic, not a legal guarantee, legal conclusion, or
substitute for legal, statistical, validation, or compliance review.

## Synthetic-Data Boundary

The cohort generator uses fixed values, IDs, dates, providers, and consent
references. It does not call external providers and does not represent real
people. Synthetic audit labels exist only to organize evaluation output; they
are not features, eligibility criteria, or a basis for individual scoring.

The package uses `scoreApplication` from `@underwriting/engine` as its only
scoring implementation. It does not copy engine formulas. If the engine rejects
a protected or proxy field, the evaluator propagates that failure rather than
silently converting the field into a score input.

## Sample-Size Limitations

Every group result includes a sample-size warning. A group below the configured
minimum is marked **insufficient sample size**. Small synthetic groups do not
provide statistical power, confidence intervals, causality, real-world
generalization, or evidence of compliance. The deterministic report is a
repeatable diagnostic fixture, not a population study.

## Official Sources Used

These sources inform the terminology and the need to treat this output as a
screening diagnostic only. They do not turn this package into legal advice:

- CFPB, Regulation B, evaluation of applications: https://www.consumerfinance.gov/rules-policy/regulations/1002/6/
- CFPB, Equal Credit Opportunity Act compliance resources: https://www.consumerfinance.gov/compliance/compliance-resources/other-applicable-requirements/equal-credit-opportunity-act/
- U.S. Equal Employment Opportunity Commission, theories of discrimination: https://www.eeoc.gov/laws/guidance/cm-604-theories-discrimination
- eCFR, Uniform Guidelines information on impact: https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607/section-1607.4
