export interface RepositoryInfo {
  id: string
  url: string
  name: string
  branch: string
  localPath?: string
  lastAnalyzed?: Date
  cacheExpiry?: Date
}

export interface TechStack {
  primary: string
  secondary: string[]
  framework?: string
  language: string
  packageManager?: string
  buildTool?: string
  testing?: string[]
  database?: string[]
  runtime?: string
}

export interface DependencyInfo {
  name: string
  version: string
  type: 'production' | 'development' | 'peer' | 'optional'
  vulnerabilities?: SecurityVulnerability[]
}

export interface SecurityVulnerability {
  id: string
  severity: 'low' | 'moderate' | 'high' | 'critical'
  title: string
  overview: string
  recommendation: string
}

export interface BuildConfiguration {
  hasDockerfile: boolean
  dockerfileAnalysis?: DockerfileAnalysis
  buildScript?: string
  startScript?: string
  testScript?: string
  customCommands?: string[]
  environmentVariables?: EnvironmentVariable[]
}

export interface DockerfileAnalysis {
  baseImage: string
  exposedPorts: number[]
  workdir?: string
  entrypoint?: string[]
  cmd?: string[]
  healthcheck?: boolean
  multiStage: boolean
}

export interface EnvironmentVariable {
  name: string
  required: boolean
  defaultValue?: string
  description?: string
  sensitive: boolean
}

export interface DeploymentRequirements {
  cpu: {
    min: number
    recommended: number
  }
  memory: {
    min: string
    recommended: string
  }
  storage: {
    min: string
    type: 'ssd' | 'hdd' | 'any'
  }
  network: {
    ports: number[]
    protocols: string[]
  }
  services: ExternalService[]
  constraints?: string[]
}

export interface ExternalService {
  name: string
  type: 'database' | 'cache' | 'queue' | 'storage' | 'api' | 'other'
  required: boolean
  version?: string
  configuration?: Record<string, any>
}

export interface DeploymentStrategy {
  type: 'static' | 'server' | 'serverless' | 'container' | 'microservice'
  approach: 'docker' | 'native' | 'pm2' | 'systemd' | 'kubernetes'
  steps: DeploymentStep[]
  infrastructure: InfrastructureRecommendation
  security: SecurityConfiguration
  monitoring: MonitoringConfiguration
  rollback: RollbackStrategy
}

export interface DeploymentStep {
  order: number
  name: string
  description: string
  command?: string
  script?: string
  dependencies?: string[]
  timeout?: number
  retries?: number
  skipOnFailure?: boolean
}

export interface InfrastructureRecommendation {
  provider: string
  instance: {
    type: string
    cpu: number
    memory: string
    storage: string
  }
  network: {
    vpc?: boolean
    loadBalancer?: boolean
    cdn?: boolean
  }
  scaling: {
    min: number
    max: number
    target: 'cpu' | 'memory' | 'requests'
    threshold: number
  }
  estimatedCost: {
    monthly: number
    currency: 'USD'
    breakdown: CostBreakdown[]
  }
}

export interface CostBreakdown {
  component: string
  cost: number
  unit: string
}

export interface SecurityConfiguration {
  https: boolean
  firewall: FirewallRule[]
  secrets: string[]
  authentication?: 'basic' | 'oauth' | 'jwt' | 'apikey'
  monitoring: boolean
  backups: BackupConfiguration
}

export interface FirewallRule {
  port: number | string
  protocol: 'tcp' | 'udp' | 'http' | 'https'
  source: 'any' | 'private' | 'specific'
  description: string
}

export interface BackupConfiguration {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  retention: number
  type: 'full' | 'incremental' | 'differential'
}

export interface MonitoringConfiguration {
  healthCheck: {
    endpoint: string
    interval: number
    timeout: number
  }
  metrics: string[]
  alerts: AlertConfiguration[]
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    retention: number
  }
}

export interface AlertConfiguration {
  name: string
  condition: string
  threshold: number
  action: 'email' | 'webhook' | 'restart'
}

export interface RollbackStrategy {
  type: 'manual' | 'automatic'
  triggers: string[]
  steps: string[]
  timeout: number
}

export interface RepositoryAnalysis {
  repository: RepositoryInfo
  techStack: TechStack
  dependencies: DependencyInfo[]
  buildConfig: BuildConfiguration
  requirements: DeploymentRequirements
  strategy: DeploymentStrategy
  confidence: number
  warnings: string[]
  recommendations: string[]
  analysisDate: Date
}