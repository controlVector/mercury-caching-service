import { simpleGit, SimpleGit } from 'simple-git'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { glob } from 'glob'
import { RepositoryInfo, RepositoryAnalysis, TechStack, DependencyInfo, BuildConfiguration } from '../types/repository'

export class RepositoryService {
  private readonly cacheDir: string
  private readonly git: SimpleGit

  constructor(cacheDir = './cache/repositories') {
    this.cacheDir = cacheDir
    this.git = simpleGit()
    this.ensureCacheDir()
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
    } catch (error) {
      console.warn('Could not create cache directory:', error)
    }
  }

  private getRepositoryId(url: string): string {
    return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '_')
  }

  private getLocalPath(repoId: string): string {
    return path.join(this.cacheDir, repoId)
  }

  async cloneOrUpdateRepository(url: string, branch = 'main', forceRefresh = false): Promise<RepositoryInfo> {
    const repoId = this.getRepositoryId(url)
    const localPath = this.getLocalPath(repoId)
    const name = this.extractRepoName(url)

    try {
      const exists = await this.pathExists(localPath)
      
      if (exists && !forceRefresh) {
        // Check if cache is still valid (less than 1 hour old)
        const stats = await fs.stat(localPath)
        const ageMs = Date.now() - stats.mtime.getTime()
        const maxAgeMs = 60 * 60 * 1000 // 1 hour
        
        if (ageMs < maxAgeMs) {
          return {
            id: repoId,
            url,
            name,
            branch,
            localPath,
            lastAnalyzed: stats.mtime,
            cacheExpiry: new Date(stats.mtime.getTime() + maxAgeMs)
          }
        }
      }

      if (exists) {
        // Update existing repository
        await this.git.cwd(localPath)
        await this.git.fetch()
        await this.git.checkout(branch)
        await this.git.pull('origin', branch)
      } else {
        // Clone new repository
        await this.git.clone(url, localPath, ['--depth', '1', '--branch', branch])
      }

      return {
        id: repoId,
        url,
        name,
        branch,
        localPath,
        lastAnalyzed: new Date(),
        cacheExpiry: new Date(Date.now() + 60 * 60 * 1000)
      }
    } catch (error: any) {
      throw new Error(`Failed to clone/update repository: ${error.message}`)
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  private extractRepoName(url: string): string {
    const match = url.match(/\/([^\/]+?)(?:\.git)?$/)
    return match ? match[1] : 'unknown'
  }

  async analyzeRepository(repoInfo: RepositoryInfo, deepAnalysis = true): Promise<RepositoryAnalysis> {
    if (!repoInfo.localPath) {
      throw new Error('Repository not cloned')
    }

    const [
      techStack,
      dependencies,
      buildConfig
    ] = await Promise.all([
      this.detectTechStack(repoInfo.localPath),
      this.analyzeDependencies(repoInfo.localPath),
      this.analyzeBuildConfiguration(repoInfo.localPath)
    ])

    const requirements = this.calculateDeploymentRequirements(techStack, dependencies, buildConfig)
    const strategy = await this.generateDeploymentStrategy(techStack, buildConfig, requirements)

    return {
      repository: repoInfo,
      techStack,
      dependencies,
      buildConfig,
      requirements,
      strategy,
      confidence: this.calculateConfidence(techStack, dependencies, buildConfig),
      warnings: this.generateWarnings(techStack, dependencies, buildConfig),
      recommendations: this.generateRecommendations(techStack, dependencies, buildConfig),
      analysisDate: new Date()
    }
  }

  private async detectTechStack(localPath: string): Promise<TechStack> {
    const files = await this.findFiles(localPath, ['package.json', 'requirements.txt', 'Gemfile', 'go.mod', 'pom.xml', 'Cargo.toml', 'composer.json'])
    
    // Node.js detection
    if (files.includes('package.json')) {
      const packageJson = await this.readJsonFile(path.join(localPath, 'package.json'))
      return this.analyzeNodejsStack(packageJson)
    }

    // Python detection
    if (files.includes('requirements.txt') || await this.pathExists(path.join(localPath, 'app.py')) || await this.pathExists(path.join(localPath, 'main.py'))) {
      return this.analyzePythonStack(localPath)
    }

    // Ruby detection
    if (files.includes('Gemfile')) {
      return this.analyzeRubyStack(localPath)
    }

    // Go detection
    if (files.includes('go.mod')) {
      return this.analyzeGoStack(localPath)
    }

    // Java detection
    if (files.includes('pom.xml')) {
      return this.analyzeJavaStack(localPath)
    }

    // Rust detection
    if (files.includes('Cargo.toml')) {
      return this.analyzeRustStack(localPath)
    }

    // PHP detection
    if (files.includes('composer.json')) {
      return this.analyzePHPStack(localPath)
    }

    // Fallback - try to detect by common files
    return this.detectByCommonFiles(localPath)
  }

  private async analyzeNodejsStack(packageJson: any): Promise<TechStack> {
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies } || {}
    
    let framework = 'none'
    if (dependencies.react || dependencies['@types/react']) framework = 'react'
    else if (dependencies.vue) framework = 'vue'
    else if (dependencies.angular || dependencies['@angular/core']) framework = 'angular'
    else if (dependencies.next) framework = 'nextjs'
    else if (dependencies.nuxt) framework = 'nuxt'
    else if (dependencies.express) framework = 'express'
    else if (dependencies.fastify) framework = 'fastify'
    else if (dependencies.nestjs || dependencies['@nestjs/core']) framework = 'nestjs'

    const buildTools = []
    if (dependencies.webpack) buildTools.push('webpack')
    if (dependencies.vite) buildTools.push('vite')
    if (dependencies.rollup) buildTools.push('rollup')
    if (dependencies.parcel) buildTools.push('parcel')

    const testingFrameworks = []
    if (dependencies.jest) testingFrameworks.push('jest')
    if (dependencies.mocha) testingFrameworks.push('mocha')
    if (dependencies.vitest) testingFrameworks.push('vitest')
    if (dependencies.cypress) testingFrameworks.push('cypress')

    return {
      primary: 'javascript',
      secondary: buildTools,
      framework,
      language: dependencies.typescript || dependencies['@types/node'] ? 'typescript' : 'javascript',
      packageManager: 'npm',
      buildTool: buildTools[0],
      testing: testingFrameworks,
      runtime: 'nodejs'
    }
  }

  private async analyzePythonStack(localPath: string): Promise<TechStack> {
    const files = await this.findFiles(localPath, ['requirements.txt', 'pyproject.toml', 'setup.py', 'app.py', 'main.py', 'manage.py'])
    
    let framework = 'none'
    let packageManager = 'pip'

    // Check for common Python frameworks
    const requirementsContent = await this.readFileIfExists(path.join(localPath, 'requirements.txt'))
    if (requirementsContent) {
      if (requirementsContent.includes('django')) framework = 'django'
      else if (requirementsContent.includes('flask')) framework = 'flask'
      else if (requirementsContent.includes('fastapi')) framework = 'fastapi'
      else if (requirementsContent.includes('tornado')) framework = 'tornado'
    }

    if (files.includes('manage.py')) framework = 'django'
    if (files.includes('pyproject.toml')) packageManager = 'poetry'

    return {
      primary: 'python',
      secondary: [],
      framework,
      language: 'python',
      packageManager,
      runtime: 'python'
    }
  }

  private async analyzeRubyStack(localPath: string): Promise<TechStack> {
    const gemfileContent = await this.readFileIfExists(path.join(localPath, 'Gemfile'))
    let framework = 'none'

    if (gemfileContent) {
      if (gemfileContent.includes('rails')) framework = 'rails'
      else if (gemfileContent.includes('sinatra')) framework = 'sinatra'
    }

    return {
      primary: 'ruby',
      secondary: [],
      framework,
      language: 'ruby',
      packageManager: 'bundler',
      runtime: 'ruby'
    }
  }

  private async analyzeGoStack(localPath: string): Promise<TechStack> {
    const goModContent = await this.readFileIfExists(path.join(localPath, 'go.mod'))
    const frameworks = []

    if (goModContent) {
      if (goModContent.includes('gin-gonic')) frameworks.push('gin')
      if (goModContent.includes('echo')) frameworks.push('echo')
      if (goModContent.includes('fiber')) frameworks.push('fiber')
    }

    return {
      primary: 'go',
      secondary: frameworks,
      framework: frameworks[0] || 'none',
      language: 'go',
      packageManager: 'go mod',
      runtime: 'go'
    }
  }

  private async analyzeJavaStack(localPath: string): Promise<TechStack> {
    return {
      primary: 'java',
      secondary: [],
      framework: 'spring', // Most common
      language: 'java',
      packageManager: 'maven',
      runtime: 'jvm'
    }
  }

  private async analyzeRustStack(localPath: string): Promise<TechStack> {
    return {
      primary: 'rust',
      secondary: [],
      framework: 'none',
      language: 'rust',
      packageManager: 'cargo',
      runtime: 'native'
    }
  }

  private async analyzePHPStack(localPath: string): Promise<TechStack> {
    const composerContent = await this.readJsonFileIfExists(path.join(localPath, 'composer.json'))
    let framework = 'none'

    if (composerContent?.require) {
      if (composerContent.require['laravel/framework']) framework = 'laravel'
      else if (composerContent.require['symfony/symfony']) framework = 'symfony'
      else if (composerContent.require['codeigniter/framework']) framework = 'codeigniter'
    }

    return {
      primary: 'php',
      secondary: [],
      framework,
      language: 'php',
      packageManager: 'composer',
      runtime: 'php'
    }
  }

  private async detectByCommonFiles(localPath: string): Promise<TechStack> {
    const htmlFiles = await glob('**/*.html', { cwd: localPath, ignore: ['node_modules/**', '.git/**'] })
    
    if (htmlFiles.length > 0) {
      return {
        primary: 'static',
        secondary: [],
        language: 'html',
        runtime: 'static'
      }
    }

    return {
      primary: 'unknown',
      secondary: [],
      language: 'unknown',
      runtime: 'unknown'
    }
  }

  private async analyzeDependencies(localPath: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = []

    // Node.js dependencies
    const packageJson = await this.readJsonFileIfExists(path.join(localPath, 'package.json'))
    if (packageJson) {
      for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
        dependencies.push({
          name,
          version: version as string,
          type: 'production'
        })
      }
      for (const [name, version] of Object.entries(packageJson.devDependencies || {})) {
        dependencies.push({
          name,
          version: version as string,
          type: 'development'
        })
      }
    }

    // Python dependencies
    const requirementsTxt = await this.readFileIfExists(path.join(localPath, 'requirements.txt'))
    if (requirementsTxt) {
      const lines = requirementsTxt.split('\n').filter(line => line.trim() && !line.startsWith('#'))
      for (const line of lines) {
        const [name, version = ''] = line.split(/[>=<~]/)[0].split('==')
        if (name.trim()) {
          dependencies.push({
            name: name.trim(),
            version: version.trim() || 'latest',
            type: 'production'
          })
        }
      }
    }

    return dependencies
  }

  private async analyzeBuildConfiguration(localPath: string): Promise<BuildConfiguration> {
    const dockerfile = await this.pathExists(path.join(localPath, 'Dockerfile'))
    const packageJson = await this.readJsonFileIfExists(path.join(localPath, 'package.json'))
    
    const config: BuildConfiguration = {
      hasDockerfile: dockerfile,
      environmentVariables: []
    }

    if (packageJson?.scripts) {
      config.buildScript = packageJson.scripts.build
      config.startScript = packageJson.scripts.start
      config.testScript = packageJson.scripts.test
    }

    // Analyze Dockerfile if present
    if (dockerfile) {
      const dockerfileContent = await this.readFileIfExists(path.join(localPath, 'Dockerfile'))
      if (dockerfileContent) {
        config.dockerfileAnalysis = this.analyzeDockerfile(dockerfileContent)
      }
    }

    // Look for environment variable references
    const envVars = await this.findEnvironmentVariables(localPath)
    config.environmentVariables = envVars

    return config
  }

  private analyzeDockerfile(content: string): any {
    const lines = content.split('\n')
    const analysis: any = {
      exposedPorts: [],
      multiStage: false
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('FROM ')) {
        analysis.baseImage = trimmed.split(' ')[1]
        if (trimmed.includes(' as ') || content.split('FROM ').length > 2) {
          analysis.multiStage = true
        }
      } else if (trimmed.startsWith('EXPOSE ')) {
        const ports = trimmed.replace('EXPOSE ', '').split(' ')
        analysis.exposedPorts.push(...ports.map(p => parseInt(p)).filter(p => !isNaN(p)))
      } else if (trimmed.startsWith('WORKDIR ')) {
        analysis.workdir = trimmed.replace('WORKDIR ', '')
      } else if (trimmed.startsWith('HEALTHCHECK ')) {
        analysis.healthcheck = true
      }
    }

    return analysis
  }

  private async findEnvironmentVariables(localPath: string): Promise<any[]> {
    const envVars: any[] = []
    
    try {
      // Look for .env.example or similar files
      const envExample = await this.readFileIfExists(path.join(localPath, '.env.example'))
      if (envExample) {
        const lines = envExample.split('\n')
        for (const line of lines) {
          if (line.trim() && !line.startsWith('#')) {
            const [name, defaultValue] = line.split('=')
            if (name) {
              envVars.push({
                name: name.trim(),
                required: true,
                defaultValue: defaultValue?.trim(),
                sensitive: name.toLowerCase().includes('password') || name.toLowerCase().includes('secret') || name.toLowerCase().includes('key')
              })
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors in env var detection
    }

    return envVars
  }

  private calculateDeploymentRequirements(techStack: TechStack, dependencies: DependencyInfo[], buildConfig: BuildConfiguration): any {
    // Base requirements
    let cpu = { min: 1, recommended: 1 }
    let memory = { min: '512MB', recommended: '1GB' }
    let storage = { min: '1GB', type: 'ssd' }
    const ports = [80]

    // Adjust based on tech stack
    if (techStack.primary === 'javascript' || techStack.primary === 'typescript') {
      memory = { min: '1GB', recommended: '2GB' }
      if (techStack.framework === 'nextjs' || techStack.framework === 'nuxt') {
        cpu = { min: 2, recommended: 4 }
        memory = { min: '2GB', recommended: '4GB' }
      }
    } else if (techStack.primary === 'python') {
      if (techStack.framework === 'django') {
        cpu = { min: 2, recommended: 2 }
        memory = { min: '1GB', recommended: '2GB' }
      }
    } else if (techStack.primary === 'java') {
      cpu = { min: 2, recommended: 4 }
      memory = { min: '2GB', recommended: '4GB' }
    }

    // Adjust for number of dependencies
    if (dependencies.length > 50) {
      memory.recommended = memory.recommended.replace(/\d+/, (match) => (parseInt(match) * 1.5).toString())
    }

    // Add HTTPS port if not present
    if (!ports.includes(443)) ports.push(443)

    // Extract ports from Dockerfile if available
    if (buildConfig.dockerfileAnalysis?.exposedPorts) {
      ports.push(...buildConfig.dockerfileAnalysis.exposedPorts)
    }

    return {
      cpu,
      memory,
      storage,
      network: {
        ports: [...new Set(ports)], // Remove duplicates
        protocols: ['http', 'https']
      },
      services: this.detectExternalServices(dependencies),
      constraints: []
    }
  }

  private detectExternalServices(dependencies: DependencyInfo[]): any[] {
    const services: any[] = []
    
    for (const dep of dependencies) {
      const name = dep.name.toLowerCase()
      
      // Database dependencies
      if (['mysql', 'mysql2', 'pg', 'postgres', 'mongodb', 'mongoose', 'redis', 'sqlite3'].includes(name)) {
        let type = 'database'
        if (name.includes('redis')) type = 'cache'
        
        services.push({
          name: name.includes('mysql') ? 'mysql' : 
                name.includes('pg') || name.includes('postgres') ? 'postgresql' :
                name.includes('mongo') ? 'mongodb' :
                name.includes('redis') ? 'redis' :
                name.includes('sqlite') ? 'sqlite' : name,
          type,
          required: dep.type === 'production'
        })
      }
    }

    return services
  }

  private async generateDeploymentStrategy(techStack: TechStack, buildConfig: BuildConfiguration, requirements: any): Promise<any> {
    const strategy: any = {
      steps: [],
      infrastructure: {},
      security: {
        https: true,
        firewall: [
          { port: 22, protocol: 'tcp', source: 'specific', description: 'SSH access' },
          { port: 80, protocol: 'http', source: 'any', description: 'HTTP traffic' },
          { port: 443, protocol: 'https', source: 'any', description: 'HTTPS traffic' }
        ],
        secrets: buildConfig.environmentVariables?.filter(env => env.sensitive).map(env => env.name) || [],
        monitoring: true,
        backups: {
          enabled: true,
          frequency: 'daily',
          retention: 7,
          type: 'incremental'
        }
      },
      monitoring: {
        healthCheck: {
          endpoint: '/health',
          interval: 30,
          timeout: 5
        },
        metrics: ['cpu', 'memory', 'disk', 'network'],
        alerts: [],
        logging: {
          level: 'info',
          retention: 7
        }
      },
      rollback: {
        type: 'manual',
        triggers: ['health_check_failed', 'deployment_timeout'],
        steps: ['stop_new_service', 'restore_previous_version', 'verify_rollback'],
        timeout: 300
      }
    }

    if (buildConfig.hasDockerfile) {
      strategy.type = 'container'
      strategy.approach = 'docker'
      strategy.steps = [
        { order: 1, name: 'Clone repository', description: 'Clone source code to deployment server', timeout: 60 },
        { order: 2, name: 'Build Docker image', description: 'Build application Docker image', timeout: 300 },
        { order: 3, name: 'Stop existing container', description: 'Stop current application container if running', timeout: 30 },
        { order: 4, name: 'Start new container', description: 'Start new application container', timeout: 60 },
        { order: 5, name: 'Health check', description: 'Verify application is healthy', timeout: 60 },
        { order: 6, name: 'Update reverse proxy', description: 'Configure Nginx/Caddy for new deployment', timeout: 30 }
      ]
    } else {
      strategy.type = 'server'
      strategy.approach = techStack.runtime === 'nodejs' ? 'pm2' : 'systemd'
      strategy.steps = this.generateNativeDeploymentSteps(techStack)
    }

    strategy.infrastructure = this.recommendInfrastructure(requirements, techStack)

    return strategy
  }

  private generateNativeDeploymentSteps(techStack: TechStack): any[] {
    if (techStack.runtime === 'nodejs') {
      return [
        { order: 1, name: 'Clone repository', description: 'Clone source code to deployment server', timeout: 60 },
        { order: 2, name: 'Install dependencies', description: 'Install Node.js dependencies', timeout: 180 },
        { order: 3, name: 'Build application', description: 'Build application if needed', timeout: 300 },
        { order: 4, name: 'Stop existing process', description: 'Stop current application process', timeout: 30 },
        { order: 5, name: 'Start with PM2', description: 'Start application with PM2 process manager', timeout: 60 },
        { order: 6, name: 'Health check', description: 'Verify application is healthy', timeout: 60 },
        { order: 7, name: 'Update reverse proxy', description: 'Configure Nginx/Caddy for new deployment', timeout: 30 }
      ]
    } else if (techStack.runtime === 'python') {
      return [
        { order: 1, name: 'Clone repository', description: 'Clone source code to deployment server', timeout: 60 },
        { order: 2, name: 'Create virtual environment', description: 'Create Python virtual environment', timeout: 30 },
        { order: 3, name: 'Install dependencies', description: 'Install Python dependencies', timeout: 180 },
        { order: 4, name: 'Run migrations', description: 'Run database migrations if needed', timeout: 120 },
        { order: 5, name: 'Stop existing service', description: 'Stop current application service', timeout: 30 },
        { order: 6, name: 'Start with Gunicorn', description: 'Start application with Gunicorn WSGI server', timeout: 60 },
        { order: 7, name: 'Health check', description: 'Verify application is healthy', timeout: 60 },
        { order: 8, name: 'Update reverse proxy', description: 'Configure Nginx for new deployment', timeout: 30 }
      ]
    }

    return [
      { order: 1, name: 'Clone repository', description: 'Clone source code to deployment server', timeout: 60 },
      { order: 2, name: 'Install dependencies', description: 'Install application dependencies', timeout: 180 },
      { order: 3, name: 'Build application', description: 'Build/compile application', timeout: 300 },
      { order: 4, name: 'Deploy application', description: 'Deploy application to target location', timeout: 60 },
      { order: 5, name: 'Health check', description: 'Verify application is healthy', timeout: 60 }
    ]
  }

  private recommendInfrastructure(requirements: any, techStack: TechStack): any {
    // Basic DigitalOcean recommendation
    let instanceType = 'basic-1vcpu-2gb'
    let estimatedCost = 24

    // Adjust based on requirements
    if (requirements.memory.recommended.includes('4GB')) {
      instanceType = 'basic-2vcpu-4gb'
      estimatedCost = 48
    } else if (requirements.cpu.recommended >= 4) {
      instanceType = 'basic-4vcpu-8gb'
      estimatedCost = 96
    }

    return {
      provider: 'digitalocean',
      instance: {
        type: instanceType,
        cpu: requirements.cpu.recommended,
        memory: requirements.memory.recommended,
        storage: '25GB'
      },
      network: {
        vpc: false,
        loadBalancer: false,
        cdn: false
      },
      scaling: {
        min: 1,
        max: 3,
        target: 'cpu',
        threshold: 80
      },
      estimatedCost: {
        monthly: estimatedCost,
        currency: 'USD',
        breakdown: [
          { component: 'Droplet', cost: estimatedCost, unit: 'month' },
          { component: 'Bandwidth', cost: 0, unit: 'month' }
        ]
      }
    }
  }

  private calculateConfidence(techStack: TechStack, dependencies: DependencyInfo[], buildConfig: BuildConfiguration): number {
    let confidence = 50

    // Increase confidence based on recognized patterns
    if (techStack.primary !== 'unknown') confidence += 20
    if (techStack.framework && techStack.framework !== 'none') confidence += 15
    if (buildConfig.hasDockerfile) confidence += 15
    if (buildConfig.startScript) confidence += 10
    if (dependencies.length > 0) confidence += 10

    return Math.min(confidence, 95) // Cap at 95%
  }

  private generateWarnings(techStack: TechStack, dependencies: DependencyInfo[], buildConfig: BuildConfiguration): string[] {
    const warnings: string[] = []

    if (techStack.primary === 'unknown') {
      warnings.push('Could not determine primary technology stack')
    }

    if (!buildConfig.hasDockerfile && !buildConfig.startScript) {
      warnings.push('No Dockerfile or start script found - may require manual configuration')
    }

    if (dependencies.length === 0) {
      warnings.push('No dependencies detected - analysis may be incomplete')
    }

    if (buildConfig.environmentVariables?.some(env => env.sensitive && !env.defaultValue)) {
      warnings.push('Sensitive environment variables detected without defaults')
    }

    return warnings
  }

  private generateRecommendations(techStack: TechStack, dependencies: DependencyInfo[], buildConfig: BuildConfiguration): string[] {
    const recommendations: string[] = []

    if (!buildConfig.hasDockerfile) {
      recommendations.push('Consider adding a Dockerfile for consistent deployments')
    }

    if (techStack.runtime === 'nodejs' && !dependencies.find(d => d.name === 'pm2')) {
      recommendations.push('Consider using PM2 for Node.js process management')
    }

    if (!buildConfig.testScript) {
      recommendations.push('Add automated tests to improve deployment confidence')
    }

    recommendations.push('Set up SSL/TLS certificate for HTTPS encryption')
    recommendations.push('Configure automated backups for data protection')
    recommendations.push('Implement monitoring and alerting for production readiness')

    return recommendations
  }

  // Utility methods
  private async findFiles(localPath: string, filenames: string[]): Promise<string[]> {
    const found: string[] = []
    
    for (const filename of filenames) {
      if (await this.pathExists(path.join(localPath, filename))) {
        found.push(filename)
      }
    }
    
    return found
  }

  private async readJsonFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      return JSON.parse(content)
    } catch (error) {
      throw new Error(`Could not read JSON file ${filePath}: ${error}`)
    }
  }

  private async readJsonFileIfExists(filePath: string): Promise<any | null> {
    try {
      return await this.readJsonFile(filePath)
    } catch {
      return null
    }
  }

  private async readFileIfExists(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch {
      return null
    }
  }
}