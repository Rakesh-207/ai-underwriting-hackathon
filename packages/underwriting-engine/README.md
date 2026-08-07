# Deterministic Underwriting Feature Engine

This package is a synthetic simulation engine. It converts consented mock Account Aggregator and DigiLocker responses into normalized features, score evidence, and anomaly metadata. It produces risk insights only and does not make real lending decisions.

## Scorecard

Scores are bounded to `300-900`, where higher means stronger simulated reliability.

### Baseline score

The baseline starts at `300` and uses only application data:

```text
baseline = clamp(300 + bureau + affordability + requestedAmount, 300, 900)
bureau = round(clamp((bureauScore - 300) / 600, 0, 1) * 300)
affordability = round(clamp(1 - paymentBurden / 0.8, 0, 1) * 180)
requestedAmount = round(clamp(1 - requestedAmount / (monthlyIncome * tenureMonths), 0, 1) * 120)
paymentBurden = (monthlyObligations + requestedAmount / tenureMonths) / monthlyIncome
```

Baseline weights are bureau `300`, affordability `180`, and requested amount/tenure `120` points.

### Dynamic score

Only consented and present signals are included. Their available weights are renormalized, so declining an optional source does not reduce the score:

```text
signalDelta = round(((signalValue - 0.5) * 2 * signalWeight * 120) / sum(availableSignalWeights))
dynamic = clamp(baseline + sum(signalDelta) + sum(explicitAnomalyDeltas), 300, 900)
```

Signal weights are income consistency `25`, cash-flow stability `25`, balance trend `15`, employment consistency `20`, account activity stability `15`, and synthetic behavior stability `20`. Education verification is evidence-only and has no score weight.

### Risk bands

- `750-900`: `strong`
- `650-749`: `moderate`
- `550-649`: `watch`
- `300-549`: `high_attention`

These are risk insights for a simulation, not lending outcomes.

## Anomaly rules

The engine emits stable, explainable flags for duplicate transaction fingerprints, credits above twice monthly income, balance changes above three times monthly income, credit amounts varying by more than three times, transactions outside the statement period, declared/verified employment mismatch, and contradictory employment dates. Flags carry source, consent, and provenance metadata. Their bounded deltas are explicit evidence contributions: `-10`, `-15`, `-10`, `-10`, `-20`, `-20`, and `-20` respectively.

## Behavior updates

`recalculateWithBehaviorUpdate` returns a new immutable input state and invokes `scoreApplication` once. The returned score identity, features, evidence, and metadata are therefore generated through the same scorecard rather than route-specific mutation.
