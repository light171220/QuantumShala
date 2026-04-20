# QuantumShala

A comprehensive quantum computing education platform built with React, TypeScript, and AWS Amplify Gen 2.

## Features

### 🎓 Learning Paths
- **9 Complete Learning Tracks** from fundamentals to specialized applications
- Interactive lessons with LaTeX math rendering
- Quizzes with multiple question types
- Progress tracking and achievements

### ⚛️ Quantum Simulator
- **Visual Circuit Builder** with drag-and-drop gates
- **Code Playground** supporting Qiskit, Cirq, PennyLane, and OpenQASM
- Browser-based simulation (up to 15 qubits)
- Real-time state vector and Bloch sphere visualization

### 🧪 Specialized Hubs
- **QML Studio** - Build and train quantum machine learning models
- **PQC Lab** - Explore post-quantum cryptography (FIPS 203/204/205)
- **Chemistry Lab** - VQE simulations for molecular systems

### 🎮 Gamification
- XP and leveling system
- Daily goals and streak tracking
- Achievements and badges
- Leaderboards

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Framer Motion
- **State**: Zustand, React Query
- **Backend**: AWS Amplify Gen 2
- **Editor**: Monaco Editor
- **Math**: KaTeX, Three.js (3D visualization)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- AWS Account (for Amplify backend)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/quantumshala.git
cd quantumshala

# Install dependencies
npm install

# Start development server
npm run dev
```

### Amplify Setup

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Start local sandbox
npm run sandbox

# Deploy to AWS
npm run deploy
```

## Project Structure

```
quantumshala/
├── amplify/               # Amplify Gen 2 backend
│   ├── auth/              # Authentication config
│   ├── data/              # GraphQL schema & resolvers
│   ├── storage/           # S3 storage config
│   └── functions/         # Lambda functions
├── public/                # Static assets
├── src/
│   ├── components/        # React components
│   │   ├── ui/            # Reusable UI components
│   │   ├── layout/        # Layout components
│   │   ├── learning/      # Learning-specific components
│   │   ├── simulator/     # Simulator components
│   │   ├── hubs/          # Specialized hub components
│   │   └── gamification/  # Gamification components
│   ├── pages/             # Page components
│   ├── hooks/             # Custom React hooks
│   ├── stores/            # Zustand stores
│   ├── services/          # API services
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   └── lib/               # Libraries (quantum simulator)
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Learning Tracks

1. **Quantum Computing Fundamentals** - Math foundations, gates, algorithms
2. **Quantum Machine Learning** - VQE, QAOA, quantum neural networks
3. **Advanced Quantum ML** - QGANs, quantum RL, barren plateaus
4. **Quantum Error Correction** - Surface codes, fault tolerance
5. **Quantum Chemistry** - Molecular simulation, drug discovery
6. **Quantum Finance** - Portfolio optimization, risk analysis
7. **Quantum Networking** - QKD, quantum internet
8. **Post-Quantum Cryptography** - Lattice, hash-based, code-based
9. **NIST PQC Standards** - FIPS 203/204/205 deep dive

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Qiskit for inspiration on circuit visualization
- PennyLane for QML concepts
- NIST for PQC documentation
