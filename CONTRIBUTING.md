# Contributing to Aegis Protocol

Thank you for your interest in contributing to Aegis Protocol by Uniq Minds!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/aegis-protocol.git`
3. Install dependencies: `npm install --legacy-peer-deps`
4. Create a branch: `git checkout -b feature/your-feature`

## Development

### Smart Contracts
```bash
npx hardhat compile          # Compile contracts
npx hardhat test             # Run all 198 tests
npx hardhat test --grep "Vault"  # Run specific tests
```

### Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev                  # Start dev server on :3000
npm run build                # Production build (verifies all 6 routes)
```

### Agent Engine
```bash
cd agent
npm install
npx ts-node src/index.ts     # Start agent (DRY_RUN=true by default)
```

## Pull Request Process

1. Ensure all tests pass: `npx hardhat test` (198 passing)
2. Ensure frontend builds: `cd frontend && npm run build` (6 routes)
3. Write tests for new contract functionality
4. Update documentation if needed
5. Submit PR against `main` branch

## Code Style

- **Solidity**: Follow OpenZeppelin patterns, use NatSpec comments, custom errors over string reverts
- **TypeScript**: Use strict types, avoid `any`
- **Frontend**: Follow existing CSS design system with custom properties (--accent, --bg-base, etc.)
- **Components**: Each page in its own route directory under `frontend/src/app/`

## Reporting Issues

Open an issue on GitHub with:
- Description of the bug or feature request
- Steps to reproduce (for bugs)
- Expected vs actual behavior

## Security

If you find a security vulnerability, please **do not** open a public issue. Instead, DM us on [Twitter @uniq_minds](https://x.com/uniq_minds).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
