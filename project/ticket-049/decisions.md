# Decision log — ticket-049

Append-only recomputable records (C-DECISION-001). Each entry binds a head SHA; do not rewrite history.

```dsl
DECISION D-049-4618
TICKET ticket-049
HEAD_SHA bb89df22e4758fb3680a438860b25949d74e0317
CORRELATION_ID todo2code-pr-ticket-049-plan
ACTOR agent:ifuri-validator-agent[bot]
APPLIED_RULE P-CORE-015
INPUT author_login = "tom-sapletta-com"
INPUT observed_checks = ["Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS","koru / code-review=PASS","Live OpenRouter contract (opt-in)=SKIPPING","Java adapter (JDK 17 required)=PASS","verify=PASS"]
INPUT required_checks = ["verify","Java adapter (JDK 17 required)","koru / code-review"]
INPUT required_checks_source = "env/request"
INPUT reviewer_login = "ifuri-validator-agent[bot]"
VERDICT APPROVE AUTHORITY DETERMINISTIC
REJECTED REQUEST_CHANGES BECAUSE NO_UNSAFE_CHANGE_REASON_FOUND
ADVISORY llm_verdict = "APPROVE" MODEL "openrouter/z-ai/glm-5.2"
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-049-7149
TICKET ticket-049
HEAD_SHA 11e7407bc76b52d051913f9f83ab482f9bb616e8
CORRELATION_ID todo2code-pr-ticket-049-plan
ACTOR agent:ifuri-validator-agent[bot]
APPLIED_RULE P-CORE-015
INPUT author_login = "tom-sapletta-com"
INPUT observed_checks = ["Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS","Live OpenRouter contract (opt-in)=SKIPPING","Java adapter (JDK 17 required)=PASS","verify=PASS","koru / code-review=PASS","Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS"]
INPUT required_checks = ["verify","Java adapter (JDK 17 required)","koru / code-review"]
INPUT required_checks_source = "env/request"
INPUT reviewer_login = "ifuri-validator-agent[bot]"
VERDICT APPROVE AUTHORITY DETERMINISTIC
REJECTED REQUEST_CHANGES BECAUSE NO_UNSAFE_CHANGE_REASON_FOUND
ADVISORY llm_verdict = "APPROVE" MODEL "openrouter/z-ai/glm-5.2"
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-049-5910
TICKET ticket-049
HEAD_SHA 979795950dcff9f7d5494b08898a7723b4089231
CORRELATION_ID todo2code-pr-ticket-049-plan
ACTOR agent:ifuri-validator-agent[bot]
APPLIED_RULE P-CORE-015
INPUT author_login = "tom-sapletta-com"
INPUT observed_checks = ["Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS","Live OpenRouter contract (opt-in)=SKIPPING","Java adapter (JDK 17 required)=PASS","verify=PASS","koru / code-review=PASS","Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS"]
INPUT required_checks = ["verify","Java adapter (JDK 17 required)","koru / code-review"]
INPUT required_checks_source = "env/request"
INPUT reviewer_login = "ifuri-validator-agent[bot]"
VERDICT APPROVE AUTHORITY DETERMINISTIC
REJECTED REQUEST_CHANGES BECAUSE NO_UNSAFE_CHANGE_REASON_FOUND
ADVISORY llm_verdict = "APPROVE" MODEL "openrouter/z-ai/glm-5.2"
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-049-8989
TICKET ticket-049
HEAD_SHA 808a0b13abfdeee99bd79502c684088b0c2496de
CORRELATION_ID todo2code-pr-ticket-049-plan
ACTOR agent:ifuri-validator-agent[bot]
APPLIED_RULE P-CORE-015
INPUT author_login = "tom-sapletta-com"
INPUT observed_checks = ["Live OpenRouter contract (opt-in)=SKIPPING","Java adapter (JDK 17 required)=PASS","verify=FAIL","Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS","koru / code-review=PASS","Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS"]
INPUT required_checks = ["verify","Java adapter (JDK 17 required)","koru / code-review"]
INPUT required_checks_source = "env/request"
INPUT reviewer_login = "ifuri-validator-agent[bot]"
VERDICT APPROVE AUTHORITY DETERMINISTIC
REJECTED REQUEST_CHANGES BECAUSE NO_UNSAFE_CHANGE_REASON_FOUND
ADVISORY llm_verdict = "BLOCK" MODEL "openrouter/z-ai/glm-5.2"
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-049-2111
TICKET ticket-049
HEAD_SHA 1a9e04eca27b23bfe94a2ff885784455681dfaca
CORRELATION_ID todo2code-pr-ticket-049-plan
ACTOR agent:ifuri-validator-agent[bot]
APPLIED_RULE P-CORE-015
INPUT author_login = "tom-sapletta-com"
INPUT observed_checks = ["Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS","Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS","koru / code-review=PASS","Live OpenRouter contract (opt-in)=SKIPPING","Java adapter (JDK 17 required)=PASS","verify=PASS"]
INPUT required_checks = ["verify","Java adapter (JDK 17 required)","koru / code-review"]
INPUT required_checks_source = "env/request"
INPUT reviewer_login = "ifuri-validator-agent[bot]"
VERDICT APPROVE AUTHORITY DETERMINISTIC
REJECTED REQUEST_CHANGES BECAUSE NO_UNSAFE_CHANGE_REASON_FOUND
ADVISORY llm_verdict = "" MODEL "openrouter/z-ai/glm-5.2"
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-049-6634
TICKET ticket-049
HEAD_SHA 06c98dec944fbb1eabe7d92737e5b96b6a5919cd
CORRELATION_ID todo2code-pr-ticket-049-plan
ACTOR agent:ifuri-validator-agent[bot]
APPLIED_RULE P-CORE-015
INPUT author_login = "tom-sapletta-com"
INPUT observed_checks = ["Live OpenRouter contract (opt-in)=SKIPPING","Java adapter (JDK 17 required)=PASS","verify=PASS","Live OpenRouter contract (opt-in)=SKIPPING","Java adapter (JDK 17 required)=PASS","verify=PASS","koru / code-review=PASS","Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS"]
INPUT required_checks = ["verify","Java adapter (JDK 17 required)","koru / code-review"]
INPUT required_checks_source = "env/request"
INPUT reviewer_login = "ifuri-validator-agent[bot]"
VERDICT APPROVE AUTHORITY DETERMINISTIC
REJECTED REQUEST_CHANGES BECAUSE NO_UNSAFE_CHANGE_REASON_FOUND
ADVISORY llm_verdict = "APPROVE" MODEL "openrouter/z-ai/glm-5.2"
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```

```dsl
DECISION D-049-3029
TICKET ticket-049
HEAD_SHA d9b42d9f43cc1a9b04031de4b2b78a80fcc67269
CORRELATION_ID todo2code-pr-ticket-049-plan
ACTOR agent:ifuri-validator-agent[bot]
APPLIED_RULE P-CORE-015
INPUT author_login = "tom-sapletta-com"
INPUT observed_checks = ["Live OpenRouter contract (opt-in)=SKIPPING","Java adapter (JDK 17 required)=PASS","verify=PASS","Live OpenRouter contract (opt-in)=SKIPPING","verify=PASS","Java adapter (JDK 17 required)=PASS","koru / code-review=PASS","Live OpenRouter contract (opt-in)=SKIPPING","Java adapter (JDK 17 required)=PASS","verify=PASS"]
INPUT required_checks = ["verify","Java adapter (JDK 17 required)","koru / code-review"]
INPUT required_checks_source = "env/request"
INPUT reviewer_login = "ifuri-validator-agent[bot]"
VERDICT APPROVE AUTHORITY DETERMINISTIC
REJECTED REQUEST_CHANGES BECAUSE NO_UNSAFE_CHANGE_REASON_FOUND
ADVISORY llm_verdict = "APPROVE" MODEL "openrouter/z-ai/glm-5.2"
ASSERT VERDICT_AUTHORITY != "ADVISORY"
```
