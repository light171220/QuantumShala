import { Helmet } from 'react-helmet-async'

interface SEOProps {
  title?: string
  description?: string
  keywords?: string[]
  image?: string
  url?: string
  type?: 'website' | 'article' | 'profile'
  author?: string
  publishedTime?: string
  modifiedTime?: string
  section?: string
  tags?: string[]
  noindex?: boolean
  canonical?: string
}

const SITE_NAME = 'QuantumShala'
const DEFAULT_TITLE = 'QuantumShala - Master Quantum Computing'
const DEFAULT_DESCRIPTION = 'The most comprehensive quantum computing education platform. Learn quantum mechanics, quantum algorithms, quantum machine learning, post-quantum cryptography, and more with interactive lessons and simulators.'
const DEFAULT_IMAGE = 'https://quantumshala.com/og-image.png'
const SITE_URL = 'https://quantumshala.com'

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = [],
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  author,
  publishedTime,
  modifiedTime,
  section,
  tags = [],
  noindex = false,
  canonical,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE
  const fullUrl = url ? `${SITE_URL}${url}` : SITE_URL
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : fullUrl
  
  const defaultKeywords = [
    'quantum computing',
    'quantum mechanics',
    'quantum algorithms',
    'qubits',
    'quantum gates',
    'quantum circuits',
    'quantum machine learning',
    'QML',
    'post-quantum cryptography',
    'PQC',
    'quantum error correction',
    'quantum chemistry',
    'VQE',
    'quantum networking',
    'learn quantum computing',
    'quantum computing tutorial',
    'quantum computing course',
    'quantum computing simulator',
    'quantum programming',
    'Qiskit',
    'Cirq',
    'PennyLane',
  ]
  
  const allKeywords = [...new Set([...keywords, ...defaultKeywords, ...tags])]
  
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
  
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      'https://twitter.com/quantumshala',
      'https://github.com/quantumshala',
      'https://linkedin.com/company/quantumshala',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@quantumshala.com',
    },
  }
  
  const courseSchema = type === 'article' && section ? {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: title,
    description: description,
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
      sameAs: SITE_URL,
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'PT20H',
    },
  } : null

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords.join(', ')} />
      {author && <meta name="author" content={author} />}
      
      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      
      {/* Article specific */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' && section && (
        <meta property="article:section" content={section} />
      )}
      {type === 'article' && tags.map(tag => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@quantumshala" />
      <meta name="twitter:creator" content="@quantumshala" />
      
      {/* Additional Meta */}
      <meta name="theme-color" content="#030712" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
      <meta name="application-name" content={SITE_NAME} />
      <meta name="msapplication-TileColor" content="#030712" />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      {courseSchema && (
        <script type="application/ld+json">
          {JSON.stringify(courseSchema)}
        </script>
      )}
    </Helmet>
  )
}

export const PageSEO = {
  Home: () => (
    <SEO
      description="Master quantum computing with the most comprehensive education platform. Interactive lessons, quantum circuit simulators, and hands-on labs for quantum algorithms, QML, and post-quantum cryptography."
      url="/"
    />
  ),
  
  Learn: () => (
    <SEO
      title="Learning Paths"
      description="Explore 9 comprehensive learning tracks covering quantum computing fundamentals, quantum machine learning, quantum algorithms, error correction, chemistry, optimization, networking, post-quantum cryptography, and hardware."
      url="/learn"
      keywords={['quantum computing courses', 'quantum computing tutorial', 'learn quantum programming']}
    />
  ),
  
  Simulator: () => (
    <SEO
      title="Quantum Simulator"
      description="Build and run quantum circuits in your browser. Our interactive simulator supports up to 15 qubits, 50+ quantum gates, real-time state visualization, and export to Qiskit, Cirq, and OpenQASM."
      url="/simulator"
      keywords={['quantum circuit simulator', 'quantum computing simulator', 'online quantum simulator', 'quantum gate simulator']}
    />
  ),
  
  CircuitBuilder: () => (
    <SEO
      title="Circuit Builder"
      description="Visual quantum circuit builder with drag-and-drop gates, real-time simulation, Bloch sphere visualization, and code export. Build Bell states, GHZ states, and custom quantum algorithms."
      url="/simulator/circuit"
      keywords={['quantum circuit builder', 'quantum circuit designer', 'build quantum circuits']}
    />
  ),
  
  QMLStudio: () => (
    <SEO
      title="QML Studio"
      description="Quantum Machine Learning studio for building and training variational quantum circuits. Create quantum neural networks, explore variational classifiers, and run hybrid quantum-classical algorithms."
      url="/hubs/qml"
      keywords={['quantum machine learning', 'QML', 'variational quantum circuits', 'quantum neural networks']}
    />
  ),
  
  ChemistryLab: () => (
    <SEO
      title="Chemistry Lab"
      description="Simulate molecular systems with VQE (Variational Quantum Eigensolver). Calculate ground state energies for molecules like H₂, LiH, and H₂O using quantum algorithms."
      url="/hubs/chemistry"
      keywords={['quantum chemistry', 'VQE', 'variational quantum eigensolver', 'molecular simulation']}
    />
  ),
  
  PQCLab: () => (
    <SEO
      title="PQC Lab"
      description="Post-Quantum Cryptography lab featuring NIST-standardized algorithms: ML-KEM (Kyber), ML-DSA (Dilithium), and SLH-DSA (SPHINCS+). Learn quantum-resistant cryptography."
      url="/hubs/pqc"
      keywords={['post-quantum cryptography', 'PQC', 'quantum resistant cryptography', 'ML-KEM', 'Kyber', 'Dilithium']}
    />
  ),
  
  About: () => (
    <SEO
      title="About"
      description="Learn about QuantumShala's mission to make quantum computing education accessible to everyone. Our team, values, and commitment to advancing quantum literacy."
      url="/about"
    />
  ),
  
  Privacy: () => (
    <SEO
      title="Privacy Policy"
      description="QuantumShala privacy policy. Learn how we collect, use, and protect your personal information."
      url="/privacy"
      noindex={true}
    />
  ),
  
  Terms: () => (
    <SEO
      title="Terms of Service"
      description="QuantumShala terms of service. Read our terms and conditions for using the platform."
      url="/terms"
      noindex={true}
    />
  ),
  
  Cookies: () => (
    <SEO
      title="Cookie Policy"
      description="QuantumShala cookie policy. Learn how we use cookies and similar technologies."
      url="/cookies"
      noindex={true}
    />
  ),
}
