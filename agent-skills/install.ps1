[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$DestinationRoot = (Join-Path $env:USERPROFILE ".codex\skills")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$skillNames = @(
    "kippy-sync-project-status",
    "kippy-plan-parallel-work",
    "kippy-release-gate",
    "kippy-ui-polish",
    "kippy-technical-architect"
)

$sourceRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$destinationRootFull = [System.IO.Path]::GetFullPath($DestinationRoot)
$pathSeparators = [char[]]@(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
)

function Test-SameOrDescendantPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Candidate,

        [Parameter(Mandatory = $true)]
        [string]$Parent
    )

    $candidateFull = [System.IO.Path]::GetFullPath($Candidate).TrimEnd($pathSeparators)
    $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd($pathSeparators)

    if ($candidateFull.Equals($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }

    return $candidateFull.StartsWith(
        $parentFull + [System.IO.Path]::DirectorySeparatorChar,
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

$destinationRootWithoutSeparator = $destinationRootFull.TrimEnd($pathSeparators)
$fileSystemRootWithoutSeparator = [System.IO.Path]::GetPathRoot($destinationRootFull).TrimEnd($pathSeparators)
if ($destinationRootWithoutSeparator.Equals($fileSystemRootWithoutSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to install skills at a filesystem root: $destinationRootFull"
}
if (Test-SameOrDescendantPath -Candidate $destinationRootFull -Parent $sourceRoot) {
    throw "Refusing a destination inside the canonical skill suite: $destinationRootFull"
}

$installPlan = foreach ($skillName in $skillNames) {
    $sourcePath = [System.IO.Path]::GetFullPath((Join-Path $sourceRoot $skillName))
    $skillFile = Join-Path $sourcePath "SKILL.md"
    $destinationPath = [System.IO.Path]::GetFullPath((Join-Path $destinationRootFull $skillName))

    if (-not (Test-Path -LiteralPath $skillFile -PathType Leaf)) {
        throw "Missing canonical skill file: $skillFile"
    }
    if (Test-SameOrDescendantPath -Candidate $destinationPath -Parent $sourcePath) {
        throw "Refusing a recursive skill destination: $destinationPath"
    }

    $state = "Install"
    if (Test-Path -LiteralPath $destinationPath) {
        $existing = Get-Item -LiteralPath $destinationPath -Force
        $existingTarget = @($existing.Target)[0]

        if ($existing.LinkType -eq "Junction" -and $existingTarget) {
            $existingTargetFull = [System.IO.Path]::GetFullPath($existingTarget)
            if ($existingTargetFull.Equals($sourcePath, [System.StringComparison]::OrdinalIgnoreCase)) {
                $state = "AlreadyInstalled"
            }
            else {
                throw "Refusing to overwrite existing skill path: $destinationPath"
            }
        }
        else {
            throw "Refusing to overwrite existing skill path: $destinationPath"
        }
    }

    [pscustomobject]@{
        SkillName       = $skillName
        SourcePath      = $sourcePath
        DestinationPath = $destinationPath
        State           = $state
    }
}

if (-not (Test-Path -LiteralPath $destinationRootFull)) {
    if ($PSCmdlet.ShouldProcess($destinationRootFull, "Create skill destination directory")) {
        New-Item -ItemType Directory -Path $destinationRootFull | Out-Null
    }
}

foreach ($item in $installPlan) {
    if ($item.State -eq "AlreadyInstalled") {
        Write-Output "Already installed: $($item.SkillName)"
        continue
    }

    if ($PSCmdlet.ShouldProcess($item.DestinationPath, "Create junction to $($item.SourcePath)")) {
        New-Item -ItemType Junction -Path $item.DestinationPath -Target $item.SourcePath | Out-Null
        Write-Output "Installed: $($item.SkillName) -> $($item.SourcePath)"
    }
}
