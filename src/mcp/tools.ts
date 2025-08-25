import { z } from 'zod'

// Input schemas for MCP tools
export const AnalyzeRepositorySchema = z.object({
  repository_url: z.string().url('Repository URL must be valid'),
  branch: z.string().default('main'),
  workspace_id: z.string(),
  user_id: z.string(),
  jwt_token: z.string(),
  force_refresh: z.boolean().default(false),
  deep_analysis: z.boolean().default(true)
})

export const GenerateDeploymentPlanSchema = z.object({
  repository_url: z.string().url('Repository URL must be valid'),
  target_environment: z.enum(['development', 'staging', 'production']).default('production'),
  infrastructure_provider: z.enum(['digitalocean', 'hetzner', 'aws', 'gcp', 'azure']).default('digitalocean'),
  budget_limit: z.number().min(5).max(10000).optional(),
  performance_tier: z.enum(['basic', 'standard', 'performance', 'enterprise']).default('standard'),
  workspace_id: z.string(),
  user_id: z.string(),
  jwt_token: z.string()
})

export const GetRepositoryCacheSchema = z.object({
  repository_url: z.string().url('Repository URL must be valid'),
  include_analysis: z.boolean().default(true),
  workspace_id: z.string(),
  user_id: z.string(),
  jwt_token: z.string()
})

export const ValidateDeploymentSchema = z.object({
  repository_url: z.string().url('Repository URL must be valid'),
  deployment_config: z.object({
    infrastructure: z.object({
      provider: z.string(),
      instance_type: z.string(),
      region: z.string()
    }),
    domain: z.string().optional(),
    ssl: z.boolean().default(true),
    environment_variables: z.record(z.string()).optional()
  }),
  workspace_id: z.string(),
  user_id: z.string(),
  jwt_token: z.string()
})

export const EstimateDeploymentCostSchema = z.object({
  repository_url: z.string().url('Repository URL must be valid'),
  infrastructure_provider: z.enum(['digitalocean', 'hetzner', 'aws', 'gcp', 'azure']).default('digitalocean'),
  instance_type: z.string().optional(),
  duration_months: z.number().min(1).max(36).default(1),
  workspace_id: z.string(),
  user_id: z.string(),
  jwt_token: z.string()
})

export const DetectSecurityIssuesSchema = z.object({
  repository_url: z.string().url('Repository URL must be valid'),
  include_dependencies: z.boolean().default(true),
  severity_threshold: z.enum(['low', 'moderate', 'high', 'critical']).default('moderate'),
  workspace_id: z.string(),
  user_id: z.string(),
  jwt_token: z.string()
})

export const MERCURY_MCP_TOOLS = [
  {
    name: 'mercury_analyze_repository',
    description: 'Analyze repository structure, dependencies, and generate deployment recommendations',
    inputSchema: AnalyzeRepositorySchema
  },
  {
    name: 'mercury_generate_deployment_plan',
    description: 'Generate comprehensive deployment plan with infrastructure specifications',
    inputSchema: GenerateDeploymentPlanSchema
  },
  {
    name: 'mercury_get_repository_cache',
    description: 'Retrieve cached repository analysis data',
    inputSchema: GetRepositoryCacheSchema
  },
  {
    name: 'mercury_validate_deployment',
    description: 'Validate deployment configuration against repository requirements',
    inputSchema: ValidateDeploymentSchema
  },
  {
    name: 'mercury_estimate_deployment_cost',
    description: 'Estimate infrastructure costs for repository deployment',
    inputSchema: EstimateDeploymentCostSchema
  },
  {
    name: 'mercury_detect_security_issues',
    description: 'Scan repository for security vulnerabilities and configuration issues',
    inputSchema: DetectSecurityIssuesSchema
  }
]

// Output types for MCP tools
export interface AnalyzeRepositoryOutput {
  success: boolean
  analysis?: {
    repository: {
      id: string
      url: string
      name: string
      branch: string
      size: number
      last_commit: string
    }
    techStack: {
      primary: string
      language: string
      framework?: string
      runtime: string
      packageManager?: string
      database?: string[]
    }
    dependencies: Array<{
      name: string
      version: string
      type: string
      vulnerabilities?: number
    }>
    buildConfiguration: {
      hasDockerfile: boolean
      buildScript?: string
      startScript?: string
      environmentVariables: string[]
    }
    deploymentStrategy: {
      type: string
      approach: string
      complexity: 'simple' | 'moderate' | 'complex'
      estimatedDeploymentTime: number
    }
    requirements: {
      cpu: { min: number; recommended: number }
      memory: { min: string; recommended: string }
      storage: { min: string; type: string }
      ports: number[]
    }
    confidence: number
    warnings: string[]
    recommendations: string[]
  }
  error?: string
  tool_name: string
  execution_time?: string
}

export interface GenerateDeploymentPlanOutput {
  success: boolean
  plan?: {
    id: string
    repository: string
    environment: string
    infrastructure: {
      provider: string
      instance: {
        type: string
        cpu: number
        memory: string
        storage: string
        region: string
      }
      estimated_cost: {
        monthly: number
        setup: number
        currency: string
      }
    }
    deployment: {
      strategy: string
      steps: Array<{
        order: number
        name: string
        description: string
        estimated_duration: number
      }>
      total_time: number
    }
    security: {
      https: boolean
      firewall_rules: Array<{
        port: number
        protocol: string
        description: string
      }>
      required_secrets: string[]
    }
    monitoring: {
      health_check: string
      metrics: string[]
      log_retention: number
    }
  }
  error?: string
  tool_name: string
  execution_time?: string
}

export interface SecurityIssuesOutput {
  success: boolean
  security_report?: {
    repository: string
    scan_date: string
    vulnerabilities: Array<{
      id: string
      severity: string
      title: string
      component: string
      recommendation: string
    }>
    summary: {
      total: number
      by_severity: Record<string, number>
      critical_count: number
    }
    recommendations: string[]
  }
  error?: string
  tool_name: string
  execution_time?: string
}