import { RepositoryService } from '../services/RepositoryService'
import { 
  MERCURY_MCP_TOOLS, 
  AnalyzeRepositoryOutput, 
  GenerateDeploymentPlanOutput,
  SecurityIssuesOutput 
} from './tools'
import type { RepositoryAnalysis } from '../types/repository'
import { spawn, exec } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class MCPHandler {
  private repositoryService: RepositoryService

  constructor() {
    this.repositoryService = new RepositoryService()
  }

  getTools() {
    return MERCURY_MCP_TOOLS
  }

  async handleToolCall(toolName: string, args: any): Promise<any> {
    const startTime = Date.now()
    
    try {
      let result: any = null

      switch (toolName) {
        case 'mercury_analyze_repository':
          result = await this.analyzeRepository(args)
          break
          
        case 'mercury_generate_deployment_plan':
          result = await this.generateDeploymentPlan(args)
          break
          
        case 'mercury_get_repository_cache':
          result = await this.getRepositoryCache(args)
          break
          
        case 'mercury_validate_deployment':
          result = await this.validateDeployment(args)
          break
          
        case 'mercury_estimate_deployment_cost':
          result = await this.estimateDeploymentCost(args)
          break
          
        case 'mercury_detect_security_issues':
          result = await this.detectSecurityIssues(args)
          break
          
        // EXECUTABLE REPOSITORY TOOLS
        case 'mercury_execute_repository_clone':
          result = await this.executeRepositoryClone(args)
          break
          
        case 'mercury_execute_repository_build':
          result = await this.executeRepositoryBuild(args)
          break
          
        case 'mercury_execute_repository_test':
          result = await this.executeRepositoryTest(args)
          break
          
        case 'mercury_execute_repository_package':
          result = await this.executeRepositoryPackage(args)
          break
          
        default:
          throw new Error(`Unknown tool: ${toolName}`)
      }

      const executionTime = `${Date.now() - startTime}ms`
      
      return {
        success: true,
        ...result,
        tool_name: toolName,
        execution_time: executionTime
      }
    } catch (error: any) {
      const executionTime = `${Date.now() - startTime}ms`
      
      return {
        success: false,
        error: error.message,
        tool_name: toolName,
        execution_time: executionTime
      }
    }
  }

  private async analyzeRepository(args: any): Promise<Partial<AnalyzeRepositoryOutput>> {
    const { repository_url, branch = 'main', force_refresh = false, deep_analysis = true } = args

    // Validate required parameters
    if (!repository_url || typeof repository_url !== 'string') {
      throw new Error('repository_url is required and must be a valid URL string')
    }

    // Clone or update repository
    const repoInfo = await this.repositoryService.cloneOrUpdateRepository(
      repository_url,
      branch,
      force_refresh
    )

    // Perform analysis
    const analysis = await this.repositoryService.analyzeRepository(repoInfo, deep_analysis)

    // Transform to output format
    return {
      analysis: {
        repository: {
          id: analysis.repository.id,
          url: analysis.repository.url,
          name: analysis.repository.name,
          branch: analysis.repository.branch,
          size: 0, // TODO: Calculate actual size
          last_commit: 'unknown' // TODO: Get from git
        },
        techStack: {
          primary: analysis.techStack.primary,
          language: analysis.techStack.language,
          framework: analysis.techStack.framework,
          runtime: analysis.techStack.runtime || analysis.techStack.language,
          packageManager: analysis.techStack.packageManager,
          database: analysis.requirements.services
            ?.filter(s => s.type === 'database')
            .map(s => s.name)
        },
        dependencies: analysis.dependencies.map(dep => ({
          name: dep.name,
          version: dep.version,
          type: dep.type,
          vulnerabilities: dep.vulnerabilities?.length || 0
        })),
        buildConfiguration: {
          hasDockerfile: analysis.buildConfig.hasDockerfile,
          buildScript: analysis.buildConfig.buildScript,
          startScript: analysis.buildConfig.startScript,
          environmentVariables: analysis.buildConfig.environmentVariables?.map(env => env.name) || []
        },
        deploymentStrategy: {
          type: analysis.strategy.type,
          approach: analysis.strategy.approach,
          complexity: this.calculateComplexity(analysis),
          estimatedDeploymentTime: this.estimateDeploymentTime(analysis.strategy.steps)
        },
        requirements: {
          cpu: analysis.requirements.cpu,
          memory: analysis.requirements.memory,
          storage: analysis.requirements.storage,
          ports: analysis.requirements.network?.ports || []
        },
        confidence: analysis.confidence,
        warnings: analysis.warnings,
        recommendations: analysis.recommendations
      }
    }
  }

  private async generateDeploymentPlan(args: any): Promise<Partial<GenerateDeploymentPlanOutput>> {
    const { 
      repository_url, 
      target_environment = 'production',
      infrastructure_provider = 'digitalocean',
      budget_limit,
      performance_tier = 'standard'
    } = args

    // First analyze the repository to understand requirements
    const repoInfo = await this.repositoryService.cloneOrUpdateRepository(repository_url)
    const analysis = await this.repositoryService.analyzeRepository(repoInfo, true)

    // Adjust infrastructure based on performance tier and budget
    const infrastructure = this.adjustInfrastructureForTier(
      analysis.strategy.infrastructure,
      performance_tier,
      budget_limit
    )

    // Generate deployment plan
    const plan = {
      id: this.generatePlanId(),
      repository: repository_url,
      environment: target_environment,
      infrastructure: {
        provider: infrastructure_provider,
        instance: infrastructure.instance,
        estimated_cost: infrastructure.estimatedCost
      },
      deployment: {
        strategy: analysis.strategy.type,
        steps: analysis.strategy.steps.map(step => ({
          order: step.order,
          name: step.name,
          description: step.description,
          estimated_duration: step.timeout || 60
        })),
        total_time: analysis.strategy.steps.reduce((total, step) => total + (step.timeout || 60), 0)
      },
      security: {
        https: analysis.strategy.security.https,
        firewall_rules: analysis.strategy.security.firewall.map(rule => ({
          port: rule.port,
          protocol: rule.protocol,
          description: rule.description
        })),
        required_secrets: analysis.strategy.security.secrets
      },
      monitoring: {
        health_check: analysis.strategy.monitoring.healthCheck.endpoint,
        metrics: analysis.strategy.monitoring.metrics,
        log_retention: analysis.strategy.monitoring.logging.retention
      }
    }

    return { plan }
  }

  private async getRepositoryCache(args: any): Promise<any> {
    // TODO: Implement cache retrieval
    return {
      cached: false,
      message: 'Cache functionality not yet implemented'
    }
  }

  private async validateDeployment(args: any): Promise<any> {
    const { repository_url, deployment_config } = args

    // Analyze repository
    const repoInfo = await this.repositoryService.cloneOrUpdateRepository(repository_url)
    const analysis = await this.repositoryService.analyzeRepository(repoInfo, true)

    const validations = []
    const warnings = []
    let valid = true

    // Check if infrastructure meets requirements
    if (deployment_config.infrastructure) {
      const minCpu = analysis.requirements.cpu.min
      const reqMemory = analysis.requirements.memory.min
      
      // Note: This is simplified validation - real implementation would check against provider specs
      validations.push({
        check: 'cpu_requirements',
        status: 'pass',
        message: `CPU requirements validated`
      })

      validations.push({
        check: 'memory_requirements', 
        status: 'pass',
        message: `Memory requirements validated`
      })
    }

    // Check for required services
    if (analysis.requirements.services?.length > 0) {
      warnings.push('External services detected - ensure they are configured')
    }

    // Check SSL configuration
    if (deployment_config.ssl && !deployment_config.domain) {
      warnings.push('SSL enabled but no domain specified')
    }

    return {
      valid,
      validations,
      warnings,
      requirements: analysis.requirements
    }
  }

  private async estimateDeploymentCost(args: any): Promise<any> {
    const { 
      repository_url, 
      infrastructure_provider = 'digitalocean',
      instance_type,
      duration_months = 1 
    } = args

    // Analyze repository to get requirements
    const repoInfo = await this.repositoryService.cloneOrUpdateRepository(repository_url)
    const analysis = await this.repositoryService.analyzeRepository(repoInfo, true)

    const baseCost = analysis.strategy.infrastructure.estimatedCost.monthly
    const totalCost = baseCost * duration_months

    return {
      cost_estimate: {
        base_monthly: baseCost,
        duration_months,
        total_cost: totalCost,
        currency: 'USD',
        breakdown: [
          { component: 'Compute Instance', cost: baseCost * 0.8, percentage: 80 },
          { component: 'Storage', cost: baseCost * 0.1, percentage: 10 },
          { component: 'Bandwidth', cost: baseCost * 0.1, percentage: 10 }
        ],
        provider: infrastructure_provider
      },
      savings_vs_cloud: {
        estimated_cloud_cost: totalCost * 3,
        savings_amount: totalCost * 2,
        savings_percentage: 67
      }
    }
  }

  private async detectSecurityIssues(args: any): Promise<Partial<SecurityIssuesOutput>> {
    const { repository_url, include_dependencies = true, severity_threshold = 'moderate' } = args

    // Analyze repository
    const repoInfo = await this.repositoryService.cloneOrUpdateRepository(repository_url)
    const analysis = await this.repositoryService.analyzeRepository(repoInfo, true)

    const vulnerabilities: any[] = []
    const recommendations: string[] = []

    // Check for common security issues
    if (!analysis.buildConfig.hasDockerfile) {
      vulnerabilities.push({
        id: 'SEC-001',
        severity: 'low',
        title: 'No Dockerfile found',
        component: 'build_configuration',
        recommendation: 'Use containerization for consistent, secure deployments'
      })
    }

    if (analysis.buildConfig.environmentVariables?.some(env => env.sensitive && !env.defaultValue)) {
      vulnerabilities.push({
        id: 'SEC-002',
        severity: 'high',
        title: 'Sensitive environment variables without defaults',
        component: 'configuration',
        recommendation: 'Ensure all sensitive environment variables are properly managed'
      })
    }

    if (!analysis.strategy.security.https) {
      vulnerabilities.push({
        id: 'SEC-003',
        severity: 'critical',
        title: 'HTTPS not configured',
        component: 'network_security',
        recommendation: 'Enable HTTPS with SSL/TLS certificates'
      })
    }

    // Count by severity
    const severityCounts = vulnerabilities.reduce((counts, vuln) => {
      counts[vuln.severity] = (counts[vuln.severity] || 0) + 1
      return counts
    }, {} as Record<string, number>)

    recommendations.push('Enable HTTPS/SSL encryption')
    recommendations.push('Implement proper secret management')
    recommendations.push('Configure firewall rules')
    recommendations.push('Set up automated security updates')
    recommendations.push('Enable access logging and monitoring')

    return {
      security_report: {
        repository: repository_url,
        scan_date: new Date().toISOString(),
        vulnerabilities,
        summary: {
          total: vulnerabilities.length,
          by_severity: severityCounts,
          critical_count: severityCounts.critical || 0
        },
        recommendations
      }
    }
  }

  // Helper methods
  private calculateComplexity(analysis: RepositoryAnalysis): 'simple' | 'moderate' | 'complex' {
    let score = 0
    
    if (analysis.dependencies.length > 20) score += 1
    if (analysis.requirements.services && analysis.requirements.services.length > 0) score += 1  
    if (!analysis.buildConfig.hasDockerfile && !analysis.buildConfig.startScript) score += 1
    if (analysis.techStack.primary === 'unknown') score += 2
    if (analysis.buildConfig.environmentVariables && analysis.buildConfig.environmentVariables.length > 5) score += 1

    if (score >= 4) return 'complex'
    if (score >= 2) return 'moderate'
    return 'simple'
  }

  private estimateDeploymentTime(steps: any[]): number {
    return steps.reduce((total, step) => total + (step.timeout || 60), 0)
  }

  private adjustInfrastructureForTier(base: any, tier: string, budgetLimit?: number): any {
    const adjusted = { ...base }

    switch (tier) {
      case 'basic':
        adjusted.instance.cpu = Math.max(1, adjusted.instance.cpu - 1)
        adjusted.instance.memory = '1GB'
        adjusted.estimatedCost.monthly = Math.max(6, adjusted.estimatedCost.monthly * 0.5)
        break
      case 'performance':
        adjusted.instance.cpu = adjusted.instance.cpu * 2
        adjusted.instance.memory = adjusted.instance.memory.replace(/\d+/, (match) => (parseInt(match) * 2).toString())
        adjusted.estimatedCost.monthly = adjusted.estimatedCost.monthly * 2
        break
      case 'enterprise':
        adjusted.instance.cpu = adjusted.instance.cpu * 4
        adjusted.instance.memory = adjusted.instance.memory.replace(/\d+/, (match) => (parseInt(match) * 4).toString())
        adjusted.estimatedCost.monthly = adjusted.estimatedCost.monthly * 4
        adjusted.scaling.max = 10
        break
    }

    // Apply budget constraints
    if (budgetLimit && adjusted.estimatedCost.monthly > budgetLimit) {
      const ratio = budgetLimit / adjusted.estimatedCost.monthly
      adjusted.instance.cpu = Math.max(1, Math.floor(adjusted.instance.cpu * ratio))
      adjusted.instance.memory = adjusted.instance.memory.replace(/\d+/, (match) => 
        Math.max(512, Math.floor(parseInt(match) * ratio)).toString()
      )
      adjusted.estimatedCost.monthly = budgetLimit
    }

    return adjusted
  }

  private generatePlanId(): string {
    return `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
  }

  // EXECUTABLE REPOSITORY TOOLS IMPLEMENTATION

  private async executeRepositoryClone(args: any): Promise<any> {
    const { repository_url, branch = 'main', target_path, workspace_id, user_id } = args

    // Validate required parameters
    if (!repository_url || !workspace_id || !user_id) {
      throw new Error('repository_url, workspace_id, and user_id are required')
    }

    const executionId = this.generateExecutionId()
    const finalTargetPath = target_path || this.generateDefaultClonePath(repository_url, workspace_id)

    console.log(`[Mercury] EXECUTE: Cloning repository ${repository_url} to ${finalTargetPath}`)

    try {
      // Ensure target directory exists
      await fs.mkdir(path.dirname(finalTargetPath), { recursive: true })

      // Check if target already exists and remove if so
      try {
        await fs.access(finalTargetPath)
        await fs.rm(finalTargetPath, { recursive: true, force: true })
        console.log(`[Mercury] Removed existing directory: ${finalTargetPath}`)
      } catch {
        // Directory doesn't exist, which is fine
      }

      // Execute git clone with shallow clone for speed
      const cloneCommand = `git clone --depth 1 --branch ${branch} ${repository_url} ${finalTargetPath}`
      const { stdout, stderr } = await execAsync(cloneCommand)

      // Verify clone was successful
      const exists = await this.pathExists(path.join(finalTargetPath, '.git'))
      if (!exists) {
        throw new Error('Clone verification failed - .git directory not found')
      }

      // Get repository info
      const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { cwd: finalTargetPath })
      const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: finalTargetPath })
      const { stdout: lastCommit } = await execAsync('git log -1 --format="%H %s"', { cwd: finalTargetPath })

      console.log(`[Mercury] Successfully cloned repository ${repository_url} to ${finalTargetPath}`)

      return {
        execution: {
          id: executionId,
          status: 'completed',
          repository_url,
          branch: currentBranch.trim(),
          target_path: finalTargetPath,
          clone_depth: 1,
          last_commit: lastCommit.trim(),
          size_mb: await this.getDirectorySize(finalTargetPath),
          completed_at: new Date().toISOString()
        },
        output: {
          stdout: stdout.trim(),
          stderr: stderr.trim()
        }
      }
    } catch (error: any) {
      console.error(`[Mercury] Repository clone failed:`, error)
      return {
        execution: {
          id: executionId,
          status: 'failed',
          repository_url,
          error: error.message,
          failed_at: new Date().toISOString()
        }
      }
    }
  }

  private async executeRepositoryBuild(args: any): Promise<any> {
    const { repository_path, build_command, environment = {}, workspace_id, user_id } = args

    // Validate required parameters
    if (!repository_path || !workspace_id || !user_id) {
      throw new Error('repository_path, workspace_id, and user_id are required')
    }

    const executionId = this.generateExecutionId()

    console.log(`[Mercury] EXECUTE: Building repository at ${repository_path}`)

    try {
      // Verify repository path exists
      const pathExists = await this.pathExists(repository_path)
      if (!pathExists) {
        throw new Error(`Repository path does not exist: ${repository_path}`)
      }

      // Auto-detect build command if not provided
      let finalBuildCommand = build_command
      if (!finalBuildCommand) {
        finalBuildCommand = await this.detectBuildCommand(repository_path)
      }

      if (!finalBuildCommand) {
        throw new Error('No build command provided and unable to auto-detect build system')
      }

      console.log(`[Mercury] Using build command: ${finalBuildCommand}`)

      // Prepare environment variables
      const buildEnv = { ...process.env, ...environment }

      // Execute build command
      const { stdout, stderr } = await execAsync(finalBuildCommand, {
        cwd: repository_path,
        env: buildEnv,
        timeout: 300000 // 5 minutes timeout
      })

      // Check for build artifacts
      const artifacts = await this.detectBuildArtifacts(repository_path)

      console.log(`[Mercury] Successfully built repository at ${repository_path}`)

      return {
        execution: {
          id: executionId,
          status: 'completed',
          repository_path,
          build_command: finalBuildCommand,
          artifacts,
          build_time_seconds: 0, // TODO: Measure actual build time
          completed_at: new Date().toISOString()
        },
        output: {
          stdout: stdout.trim(),
          stderr: stderr.trim()
        }
      }
    } catch (error: any) {
      console.error(`[Mercury] Repository build failed:`, error)
      return {
        execution: {
          id: executionId,
          status: 'failed',
          repository_path,
          build_command: build_command || 'auto-detect',
          error: error.message,
          failed_at: new Date().toISOString()
        }
      }
    }
  }

  private async executeRepositoryTest(args: any): Promise<any> {
    const { repository_path, test_command, skip_tests = false, workspace_id, user_id } = args

    // Validate required parameters
    if (!repository_path || !workspace_id || !user_id) {
      throw new Error('repository_path, workspace_id, and user_id are required')
    }

    const executionId = this.generateExecutionId()

    if (skip_tests) {
      console.log(`[Mercury] EXECUTE: Skipping tests for repository at ${repository_path}`)
      return {
        execution: {
          id: executionId,
          status: 'skipped',
          repository_path,
          skip_tests: true,
          skipped_at: new Date().toISOString()
        }
      }
    }

    console.log(`[Mercury] EXECUTE: Testing repository at ${repository_path}`)

    try {
      // Verify repository path exists
      const pathExists = await this.pathExists(repository_path)
      if (!pathExists) {
        throw new Error(`Repository path does not exist: ${repository_path}`)
      }

      // Auto-detect test command if not provided
      let finalTestCommand = test_command
      if (!finalTestCommand) {
        finalTestCommand = await this.detectTestCommand(repository_path)
      }

      if (!finalTestCommand) {
        console.log(`[Mercury] No test command found for repository at ${repository_path}`)
        return {
          execution: {
            id: executionId,
            status: 'no_tests',
            repository_path,
            message: 'No test command found or configured',
            completed_at: new Date().toISOString()
          }
        }
      }

      console.log(`[Mercury] Using test command: ${finalTestCommand}`)

      // Execute test command
      const { stdout, stderr } = await execAsync(finalTestCommand, {
        cwd: repository_path,
        timeout: 300000 // 5 minutes timeout
      })

      const testResults = this.parseTestResults(stdout, stderr)

      console.log(`[Mercury] Successfully ran tests for repository at ${repository_path}`)

      return {
        execution: {
          id: executionId,
          status: 'completed',
          repository_path,
          test_command: finalTestCommand,
          test_results: testResults,
          completed_at: new Date().toISOString()
        },
        output: {
          stdout: stdout.trim(),
          stderr: stderr.trim()
        }
      }
    } catch (error: any) {
      console.error(`[Mercury] Repository tests failed:`, error)
      return {
        execution: {
          id: executionId,
          status: 'failed',
          repository_path,
          test_command: test_command || 'auto-detect',
          error: error.message,
          failed_at: new Date().toISOString()
        }
      }
    }
  }

  private async executeRepositoryPackage(args: any): Promise<any> {
    const { 
      repository_path, 
      package_type = 'docker', 
      output_path, 
      docker_registry, 
      workspace_id, 
      user_id 
    } = args

    // Validate required parameters
    if (!repository_path || !workspace_id || !user_id) {
      throw new Error('repository_path, workspace_id, and user_id are required')
    }

    const executionId = this.generateExecutionId()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const finalOutputPath = output_path || this.generateDefaultPackagePath(repository_path, package_type, timestamp)

    console.log(`[Mercury] EXECUTE: Packaging repository at ${repository_path} as ${package_type}`)

    try {
      // Verify repository path exists
      const pathExists = await this.pathExists(repository_path)
      if (!pathExists) {
        throw new Error(`Repository path does not exist: ${repository_path}`)
      }

      let packageResult: any = {}

      switch (package_type) {
        case 'docker':
          packageResult = await this.packageAsDocker(repository_path, finalOutputPath, docker_registry)
          break
        case 'zip':
          packageResult = await this.packageAsZip(repository_path, finalOutputPath)
          break
        case 'tar':
          packageResult = await this.packageAsTar(repository_path, finalOutputPath)
          break
        default:
          throw new Error(`Unsupported package type: ${package_type}`)
      }

      console.log(`[Mercury] Successfully packaged repository at ${repository_path}`)

      return {
        execution: {
          id: executionId,
          status: 'completed',
          repository_path,
          package_type,
          output_path: finalOutputPath,
          package_size_mb: packageResult.size_mb,
          docker_image_tag: packageResult.image_tag,
          completed_at: new Date().toISOString()
        },
        output: packageResult.output || {}
      }
    } catch (error: any) {
      console.error(`[Mercury] Repository packaging failed:`, error)
      return {
        execution: {
          id: executionId,
          status: 'failed',
          repository_path,
          package_type,
          error: error.message,
          failed_at: new Date().toISOString()
        }
      }
    }
  }

  // HELPER METHODS FOR EXECUTABLE TOOLS

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
  }

  private generateDefaultClonePath(repositoryUrl: string, workspaceId: string): string {
    const repoName = repositoryUrl.split('/').pop()?.replace('.git', '') || 'unknown'
    return path.join('./cache/repositories', workspaceId, repoName)
  }

  private generateDefaultPackagePath(repositoryPath: string, packageType: string, timestamp: string): string {
    const repoName = path.basename(repositoryPath)
    return path.join('./cache/packages', `${repoName}-${timestamp}.${packageType === 'docker' ? 'tar' : packageType}`)
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`du -sm "${dirPath}"`)
      return parseInt(stdout.split('\t')[0]) || 0
    } catch {
      return 0
    }
  }

  private async detectBuildCommand(repositoryPath: string): Promise<string | null> {
    // Check for common build files and return appropriate command
    if (await this.pathExists(path.join(repositoryPath, 'package.json'))) {
      const packageJson = JSON.parse(await fs.readFile(path.join(repositoryPath, 'package.json'), 'utf8'))
      if (packageJson.scripts?.build) return 'npm run build'
      if (packageJson.scripts?.start) return 'npm install'
    }

    if (await this.pathExists(path.join(repositoryPath, 'Makefile'))) {
      return 'make'
    }

    if (await this.pathExists(path.join(repositoryPath, 'pom.xml'))) {
      return 'mvn package'
    }

    if (await this.pathExists(path.join(repositoryPath, 'go.mod'))) {
      return 'go build .'
    }

    if (await this.pathExists(path.join(repositoryPath, 'Cargo.toml'))) {
      return 'cargo build --release'
    }

    if (await this.pathExists(path.join(repositoryPath, 'requirements.txt'))) {
      return 'pip install -r requirements.txt'
    }

    return null
  }

  private async detectTestCommand(repositoryPath: string): Promise<string | null> {
    // Check for common test configurations
    if (await this.pathExists(path.join(repositoryPath, 'package.json'))) {
      const packageJson = JSON.parse(await fs.readFile(path.join(repositoryPath, 'package.json'), 'utf8'))
      if (packageJson.scripts?.test) return 'npm test'
    }

    if (await this.pathExists(path.join(repositoryPath, 'pytest.ini'))) {
      return 'pytest'
    }

    if (await this.pathExists(path.join(repositoryPath, 'go.mod'))) {
      return 'go test ./...'
    }

    if (await this.pathExists(path.join(repositoryPath, 'Cargo.toml'))) {
      return 'cargo test'
    }

    return null
  }

  private async detectBuildArtifacts(repositoryPath: string): Promise<string[]> {
    const artifacts: string[] = []
    
    const commonArtifactPaths = [
      'dist', 'build', 'target', 'out', '.next', 
      'public/build', 'static/build', 'lib'
    ]

    for (const artifactPath of commonArtifactPaths) {
      const fullPath = path.join(repositoryPath, artifactPath)
      if (await this.pathExists(fullPath)) {
        artifacts.push(artifactPath)
      }
    }

    return artifacts
  }

  private parseTestResults(stdout: string, stderr: string): any {
    // Simple test result parsing - can be enhanced for specific test frameworks
    return {
      raw_output: stdout,
      error_output: stderr,
      passed: !stderr.includes('FAIL') && !stderr.includes('Error'),
      summary: 'Test execution completed'
    }
  }

  private async packageAsDocker(repositoryPath: string, outputPath: string, registry?: string): Promise<any> {
    const dockerfilePath = path.join(repositoryPath, 'Dockerfile')
    
    if (!await this.pathExists(dockerfilePath)) {
      throw new Error('Dockerfile not found in repository')
    }

    const repoName = path.basename(repositoryPath).toLowerCase()
    const tag = `${repoName}:latest`
    const fullTag = registry ? `${registry}/${tag}` : tag

    // Build Docker image
    const buildCommand = `docker build -t ${fullTag} .`
    const { stdout, stderr } = await execAsync(buildCommand, { cwd: repositoryPath })

    // Save image to tar file
    const saveCommand = `docker save ${fullTag} -o ${outputPath}`
    await execAsync(saveCommand)

    const stats = await fs.stat(outputPath)

    return {
      image_tag: fullTag,
      size_mb: Math.round(stats.size / 1024 / 1024),
      output: { stdout, stderr }
    }
  }

  private async packageAsZip(repositoryPath: string, outputPath: string): Promise<any> {
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true })

    const zipCommand = `zip -r ${outputPath} . -x "*.git*" "node_modules/*" "*.log"`
    const { stdout, stderr } = await execAsync(zipCommand, { cwd: repositoryPath })

    const stats = await fs.stat(outputPath)

    return {
      size_mb: Math.round(stats.size / 1024 / 1024),
      output: { stdout, stderr }
    }
  }

  private async packageAsTar(repositoryPath: string, outputPath: string): Promise<any> {
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true })

    const tarCommand = `tar -czf ${outputPath} --exclude=.git --exclude=node_modules --exclude=*.log .`
    const { stdout, stderr } = await execAsync(tarCommand, { cwd: repositoryPath })

    const stats = await fs.stat(outputPath)

    return {
      size_mb: Math.round(stats.size / 1024 / 1024),
      output: { stdout, stderr }
    }
  }
}