# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Do not open a public issue.** Instead, email **skander@bentech.app**
with details. Expect a response within 48 hours.

### What to Include

- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential mitigations you've identified

### Process

1. You report the vulnerability privately
2. We acknowledge receipt within 48 hours
3. We investigate and develop a fix
4. We release a patch and publish an advisory
5. You get credited in the advisory (unless you prefer to remain anonymous)

## Security Best Practices for Deployments

- **Never expose the ADMS port (8085) to the public internet.** Scanners should be on a private VLAN or VPN.
- **Use a strong `TIMEKEEP_JWT_SECRET`** (at least 64 random characters).
- **Always run behind a reverse proxy** (nginx, Caddy) with TLS in production.
- **Rotate API keys regularly.**
- **Keep the binary up to date** — check the GitHub releases page.
