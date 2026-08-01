@echo off
setlocal EnableDelayedExpansion
:: Author: Tom Sapletta · https://tom.sapletta.com
:: Part of the ifURI solution.
:: Windows equivalent of project.sh

cls

if not "%T2C_SKIP_GOVERNANCE%"=="1" (
    call "%~dp0project\governance-check.bat" --actor agent
    if errorlevel 1 exit /b %ERRORLEVEL%
)

set PIP_DISABLE_PIP_VERSION_CHECK=1

set VENV=venv
set PIP=%VENV%\Scripts\pip.exe

if not exist "%PIP%" (
    echo Creating virtual environment...
    python -m venv %VENV%
)

"%PIP%" install --upgrade pip -q 2>nul

"%PIP%" install regix --upgrade --quiet
"%PIP%" install prefact --upgrade --quiet
"%PIP%" install vallm --upgrade --quiet
"%PIP%" install redup --upgrade --quiet
"%PIP%" install glon --upgrade --quiet
"%PIP%" install code2logic --upgrade --quiet
"%PIP%" install code2llm --upgrade --quiet

"%VENV%\Scripts\code2llm.exe" ./ -f all -o ./project --no-chunk --exclude "*.md"
"%VENV%\Scripts\redup.exe" scan . --format toon --output ./project --ext .mjs,.js,.php,.sh
"%VENV%\Scripts\prefact.exe" -a -e "examples/**"

"%PIP%" install doql --upgrade --quiet
"%VENV%\Scripts\doql.exe" adopt . --format less --output app.doql.less --force

"%PIP%" install sumd --upgrade --quiet
"%VENV%\Scripts\sumd.exe" .
"%VENV%\Scripts\sumr.exe" .

if exist "..\goal\goal" (
    if exist "..\goal\pyproject.toml" (
        pip install -e ..\goal
        "%PIP%" install -e ..\goal --quiet
    )
) else (
    pip install -U goal
    "%PIP%" install goal --upgrade --quiet
)

if exist ".\tree.bat" (
    call .\tree.bat
) else (
    echo Skipping tree snapshot: tree.bat not found.
)
