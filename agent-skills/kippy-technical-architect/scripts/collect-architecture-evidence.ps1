[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string[]]$RepositoryRoot,

    [ValidateRange(1, 500)]
    [int]$MaxItems = 50
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-GitReadOnly {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = @(& git --no-optional-locks -C $Root @Arguments 2>&1 | ForEach-Object { "$_" })
    $exitCode = $LASTEXITCODE

    [pscustomobject]@{
        ExitCode = $exitCode
        Output   = $output
    }
}

function Get-ResultText {
    param([Parameter(Mandatory = $true)]$Result)

    if ($Result.ExitCode -ne 0 -or $Result.Output.Count -eq 0) {
        return $null
    }

    return [string]::Join([Environment]::NewLine, $Result.Output).Trim()
}

function New-LimitedInventory {
    param(
        [AllowEmptyCollection()]
        [string[]]$Items,

        [Parameter(Mandatory = $true)]
        [int]$Limit
    )

    $normalized = @(
        $Items |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            ForEach-Object { $_ -replace '\\', '/' } |
            Sort-Object -Unique
    )

    [pscustomobject]@{
        count     = $normalized.Count
        truncated = $normalized.Count -gt $Limit
        items     = @($normalized | Select-Object -First $Limit)
    }
}

function Get-PackageSummary {
    param([Parameter(Mandatory = $true)][string]$Root)

    $packagePath = Join-Path $Root "package.json"
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
        return $null
    }

    try {
        $package = Get-Content -Raw -Encoding utf8 -LiteralPath $packagePath | ConvertFrom-Json
        $name = $null
        $packageManager = $null
        $scripts = @()

        if ($null -ne $package.PSObject.Properties["name"]) {
            $name = [string]$package.name
        }
        if ($null -ne $package.PSObject.Properties["packageManager"]) {
            $packageManager = [string]$package.packageManager
        }
        if ($null -ne $package.PSObject.Properties["scripts"] -and $null -ne $package.scripts) {
            $scripts = @($package.scripts.PSObject.Properties.Name | Sort-Object)
        }

        return [pscustomobject]@{
            path            = "package.json"
            name            = $name
            package_manager = $packageManager
            script_names    = $scripts
        }
    }
    catch {
        return [pscustomobject]@{
            path  = "package.json"
            error = "Package manifest could not be parsed."
        }
    }
}

function Get-RepositoryEvidence {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RequestedRoot,

        [Parameter(Mandatory = $true)]
        [int]$Limit
    )

    $resolved = Resolve-Path -LiteralPath $RequestedRoot -ErrorAction Stop
    $root = [System.IO.Path]::GetFullPath($resolved.Path)

    $inside = Invoke-GitReadOnly -Root $root -Arguments @("rev-parse", "--is-inside-work-tree")
    if ($inside.ExitCode -ne 0 -or (Get-ResultText $inside) -ne "true") {
        return [pscustomobject]@{
            requested_root = $RequestedRoot
            resolved_root  = $root
            error          = "Path is not a Git worktree."
        }
    }

    $topLevelResult = Invoke-GitReadOnly -Root $root -Arguments @("rev-parse", "--show-toplevel")
    $branchResult = Invoke-GitReadOnly -Root $root -Arguments @("branch", "--show-current")
    $headResult = Invoke-GitReadOnly -Root $root -Arguments @("rev-parse", "--short=12", "HEAD")
    $statusResult = Invoke-GitReadOnly -Root $root -Arguments @("status", "--porcelain=v1", "--untracked-files=normal")
    $upstreamResult = Invoke-GitReadOnly -Root $root -Arguments @("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
    $remoteResult = Invoke-GitReadOnly -Root $root -Arguments @("remote")
    $worktreeResult = Invoke-GitReadOnly -Root $root -Arguments @("worktree", "list", "--porcelain")
    $fileResult = Invoke-GitReadOnly -Root $root -Arguments @(
        "ls-files", "-co", "--exclude-standard", "--", ".",
        ":(exclude).gradle/**",
        ":(exclude).gradle-home/**",
        ":(exclude).idea/**",
        ":(exclude)build/**",
        ":(exclude)**/build/**",
        ":(exclude)node_modules/**",
        ":(exclude)**/node_modules/**",
        ":(exclude)dist/**",
        ":(exclude)**/dist/**",
        ":(exclude)tmp-apks-inspect/**",
        ":(exclude)test-results/**",
        ":(exclude)playwright-report/**"
    )

    $status = @($statusResult.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $files = @($fileResult.Output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $upstream = Get-ResultText $upstreamResult
    $ahead = $null
    $behind = $null

    if ($upstream) {
        $countsResult = Invoke-GitReadOnly -Root $root -Arguments @("rev-list", "--left-right", "--count", "HEAD...@{upstream}")
        if ($countsResult.ExitCode -eq 0 -and $countsResult.Output.Count -gt 0) {
            $parts = @($countsResult.Output[0] -split '\s+' | Where-Object { $_ -ne "" })
            if ($parts.Count -eq 2) {
                $ahead = [int]$parts[0]
                $behind = [int]$parts[1]
            }
        }
    }

    $manifests = @($files | Where-Object {
        $_ -match '(^|/)(package\.json|deno\.jsonc?|Cargo\.toml|pyproject\.toml|requirements[^/]*\.txt|settings\.gradle(\.kts)?|build\.gradle(\.kts)?|gradle\.properties|Podfile|Package\.swift|supabase/config\.toml)$'
    })
    $sourceDocuments = @($files | Where-Object {
        $_ -match '(?i)(source[_-]?of[_-]?truth|architecture|technical[_-]?contract|execution[_-]?plan|(^|/)adr[s]?(/|[-_]))' -and $_ -match '(?i)\.(md|txt|yaml|yml|json)$'
    })
    $migrations = @($files | Where-Object { $_ -match '(?i)(^|/)supabase(?:-v2)?/(?:supabase/)?migrations/[^/]+\.sql$' })
    $functions = @($files | Where-Object { $_ -match '(?i)(^|/)supabase(?:-v2)?/(?:supabase/)?functions/[^/]+/' })
    $routes = @($files | Where-Object { $_ -match '(?i)(^|/)(src|app)/.*(route|router|App\.(tsx|ts|jsx|js)$)' })
    $tests = @($files | Where-Object { $_ -match '(?i)(^|/)(test|tests|e2e|androidTest|src/test)(/|$)|\.(spec|test)\.[^.]+$' })
    $ci = @($files | Where-Object { $_ -match '(?i)^\.github/workflows/.*\.(yaml|yml)$' })
    $featureFlags = @($files | Where-Object { $_ -match '(?i)(feature[-_]?flags?|flags?)\.[^.]+$' })

    [pscustomobject]@{
        requested_root              = $RequestedRoot
        resolved_root               = $root
        repository_root             = Get-ResultText $topLevelResult
        branch                      = Get-ResultText $branchResult
        head                        = Get-ResultText $headResult
        dirty                       = $status.Count -gt 0
        untracked_status_mode       = "normal"
        status_count                = $status.Count
        status_sample               = @($status | Select-Object -First $Limit)
        status_truncated            = $status.Count -gt $Limit
        upstream                    = $upstream
        ahead_of_local_upstream     = $ahead
        behind_local_upstream       = $behind
        remote_names                = @($remoteResult.Output | Sort-Object -Unique)
        remote_state                = "UNVERIFIED_NO_FETCH"
        worktrees_porcelain         = @($worktreeResult.Output | Select-Object -First ($Limit * 4))
        package_manifest            = Get-PackageSummary -Root $root
        gradle_wrapper_present      = (Test-Path -LiteralPath (Join-Path $root "gradlew")) -or (Test-Path -LiteralPath (Join-Path $root "gradlew.bat"))
        inventory                   = [pscustomobject]@{
            manifests        = New-LimitedInventory -Items $manifests -Limit $Limit
            source_documents = New-LimitedInventory -Items $sourceDocuments -Limit $Limit
            migrations       = New-LimitedInventory -Items $migrations -Limit $Limit
            function_files   = New-LimitedInventory -Items $functions -Limit $Limit
            route_files      = New-LimitedInventory -Items $routes -Limit $Limit
            test_files       = New-LimitedInventory -Items $tests -Limit $Limit
            ci_workflows     = New-LimitedInventory -Items $ci -Limit $Limit
            feature_flags    = New-LimitedInventory -Items $featureFlags -Limit $Limit
        }
    }
}

$repositories = foreach ($requestedRoot in $RepositoryRoot) {
    try {
        Get-RepositoryEvidence -RequestedRoot $requestedRoot -Limit $MaxItems
    }
    catch {
        [pscustomobject]@{
            requested_root = $requestedRoot
            error          = $_.Exception.Message
        }
    }
}

$result = [ordered]@{
    schema_version     = 1
    captured_at        = [DateTimeOffset]::Now.ToString("o")
    mode               = "READ_ONLY"
    network_access     = $false
    files_written      = $false
    secret_values_read = $false
    git_optional_locks = $false
    repository_count   = @($repositories).Count
    repositories       = @($repositories)
}

$result | ConvertTo-Json -Depth 12
