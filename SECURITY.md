# Security Policy

## Supported Versions

We release security updates for the following versions:
- **Current**: Latest release on `main` branch
- **Previous**: Previous major version (if applicable)

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please:

1. **Do NOT** open a public issue
2. Send details to: [your-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

## Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Release**: Based on severity and complexity

## Security Best Practices

This project follows these security practices:

### Dependencies
- Regular dependency audits via CI/CD pipeline
- Automated vulnerability scanning on every PR
- Critical/High vulnerabilities block merges

### Code Security
- Static code analysis via GitHub CodeQL
- No hardcoded secrets or credentials
- Input validation and sanitization
- SQL injection prevention via Prisma ORM
- XSS prevention via Content Security Policy

### Infrastructure
- HTTPS only for all endpoints
- Secure cookie configuration
- Rate limiting on API endpoints
- Helmet.js for security headers

## Known Security Considerations

### Current Vulnerabilities
Check the [Security tab](../../security) for the latest scan results.

### Third-Party Dependencies
This project uses npm packages which may have their own vulnerabilities.
We monitor these through automated scanning.

## Security Updates

Security patches are released as:
- **Critical**: Within 24-72 hours
- **High**: Within 1 week
- **Moderate/Low**: Next scheduled release

Subscribe to releases to get notified about security updates.
