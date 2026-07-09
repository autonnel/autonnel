# Security Policy

Autonnel handles checkout, payments, and customer data, so we take security
reports seriously and appreciate responsible disclosure.

## Supported versions

Autonnel is currently on **v1.3**. Security fixes land on the latest published `1.x` release.
Please always reproduce against the most recent version before reporting.

| Version        | Supported |
| -------------- | --------- |
| latest `1.x`   | ✅        |
| older releases | ❌        |

## Reporting a vulnerability

**Do not open a public issue, pull request, or discussion for security
problems.** Public disclosure of a payment/checkout bug puts every deployment at
risk before a fix ships.

Instead, use GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Include a description, affected version/commit, reproduction steps, and impact.

We aim to acknowledge reports within **3 business days** and to provide a
remediation timeline after triage. Please give us reasonable time to release a
fix before any public disclosure.

## Scope

In scope: the `autonnel` package (integration, CLI, adapters, storefront and
admin routes, auth, payment/webhook handling).

Out of scope: vulnerabilities in third-party services (Stripe, PayPal, Shopify,
WooCommerce, Cloudflare, etc.), and misconfigurations in a deployer's own
infrastructure or credentials.

## Handling secrets

Autonnel never commits credentials. Runtime secrets belong in environment
variables or the `AppConfig` KV store — see `.env.example`. If you believe a
secret was exposed in this repository or its history, report it privately using
the process above.
