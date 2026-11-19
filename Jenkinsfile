// =============================================================================
// Jenkinsfile — Thaala CI/CD (declarative pipeline)
//
// What it does
//   PRs:          install → quality checks → security scans → build + scan images
//   main branch:  …all of the above → push to ECR → migrate → deploy STAGING → smoke tests
//   tags v*:      deploy the SAME image digest that passed staging to PROD after approval
//
// Security design (see docs/SECURITY.md §9, §11 and docs/DEPLOYMENT.md)
//   - No AWS access keys in Jenkins: the agent's IAM role assumes a deploy role per account.
//   - Third-party tokens come from Jenkins credentials and are masked in logs.
//   - Builds fail on leaked secrets, SAST findings, vulnerable dependencies or images.
//   - Prod never rebuilds; it promotes the staging-tested image by SHA tag.
//
// Agent requirements
//   Label 'docker-node' with: Docker + Buildx, Node 24, pnpm (corepack), AWS CLI v2,
//   jq, gitleaks, semgrep, osv-scanner, trivy, syft.
// =============================================================================

pipeline {
  // Every build runs on an ephemeral agent so nothing leaks between builds.
  agent { label 'docker-node' }

  options {
    timestamps()                                   // timestamps in the console log
    ansiColor('xterm')                             // readable coloured tool output
    timeout(time: 60, unit: 'MINUTES')             // never let a stuck build run forever
    disableConcurrentBuilds(abortPrevious: true)   // newer commits cancel older builds on the same branch
    buildDiscarder(logRotator(numToKeepStr: '30')) // keep log storage bounded
  }

  parameters {
    // Lets a release manager redeploy an earlier image (rollback) without rebuilding.
    string(name: 'ROLLBACK_IMAGE_TAG', defaultValue: '', description: 'Optional: git SHA of a previous image to redeploy (skips build stages)')
  }

  environment {
    AWS_REGION        = 'ap-south-1'
    // Account ids and role ARNs are not secrets, but they are kept in Jenkins global
    // properties so the file stays the same across forks and environments.
    STAGING_ACCOUNT   = "${env.THAALA_STAGING_ACCOUNT_ID}"
    PROD_ACCOUNT      = "${env.THAALA_PROD_ACCOUNT_ID}"
    STAGING_ROLE_ARN  = "arn:aws:iam::${env.THAALA_STAGING_ACCOUNT_ID}:role/JenkinsDeployRole"
    PROD_ROLE_ARN     = "arn:aws:iam::${env.THAALA_PROD_ACCOUNT_ID}:role/JenkinsDeployRole"
    PNPM_HOME         = "${env.WORKSPACE}/.pnpm"
    // Turborepo and Next.js telemetry off in CI.
    TURBO_TELEMETRY_DISABLED = '1'
    NEXT_TELEMETRY_DISABLED  = '1'
  }

  stages {

    // -------------------------------------------------------------------------
    // Work out the immutable image tag for this build.
    // -------------------------------------------------------------------------
    stage('Prepare') {
      steps {
        script {
          // Short SHA is used as the image tag; ECR tag immutability stops overwrites.
          env.GIT_SHA   = sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()
          env.IMAGE_TAG = params.ROLLBACK_IMAGE_TAG?.trim() ? params.ROLLBACK_IMAGE_TAG.trim() : env.GIT_SHA
          env.IS_ROLLBACK = params.ROLLBACK_IMAGE_TAG?.trim() ? 'true' : 'false'
          echo "Image tag: ${env.IMAGE_TAG} (rollback=${env.IS_ROLLBACK})"
        }
      }
    }

    // -------------------------------------------------------------------------
    // Install exactly what the lockfile says. --frozen-lockfile fails if
    // package.json and pnpm-lock.yaml disagree (supply-chain safety).
    // -------------------------------------------------------------------------
    stage('Install') {
      when { expression { env.IS_ROLLBACK == 'false' } }
      steps {
        sh '''
          corepack enable
          pnpm config set store-dir "$PNPM_HOME/store"
          pnpm install --frozen-lockfile
        '''
      }
    }

    // -------------------------------------------------------------------------
    // Code quality, in parallel to keep feedback fast.
    // -------------------------------------------------------------------------
    stage('Quality') {
      when { expression { env.IS_ROLLBACK == 'false' } }
      parallel {
        stage('Lint (incl. TSDoc rule)') { steps { sh 'pnpm lint' } }
        stage('Typecheck')               { steps { sh 'pnpm typecheck' } }
        stage('Unit + integration tests') {
          steps {
            // Integration tests need a throwaway Postgres. It is started on a random host
            // port and removed afterwards, even if tests fail.
            sh '''
              set -euo pipefail
              cid=$(docker run -d --rm -e POSTGRES_PASSWORD=ci-only-not-a-secret -e POSTGRES_DB=thaala_test -p 0:5432 postgres:17-alpine)
              trap "docker stop $cid >/dev/null" EXIT
              port=$(docker port "$cid" 5432/tcp | head -n1 | awk -F: '{print $NF}')
              # Wait until Postgres accepts connections (max ~30 s).
              for i in $(seq 1 30); do docker exec "$cid" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
              DATABASE_URL="postgres://postgres:ci-only-not-a-secret@localhost:${port}/thaala_test" pnpm test -- --reporter=junit --outputFile=reports/junit.xml
            '''
          }
          post { always { junit allowEmptyResults: true, testResults: '**/reports/junit.xml' } }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Security gates. Any high/critical finding fails the build.
    // -------------------------------------------------------------------------
    stage('Security scans') {
      when { expression { env.IS_ROLLBACK == 'false' } }
      parallel {
        stage('Secrets (gitleaks)') {
          // Scans the full git history of the branch for committed secrets.
          steps { sh 'gitleaks detect --source . --redact --no-banner --exit-code 1' }
        }
        stage('SAST (semgrep)') {
          // OWASP Top 10, TypeScript, React and Dockerfile rules; errors fail the build.
          steps { sh 'semgrep scan --config p/owasp-top-ten --config p/typescript --config p/react --config p/dockerfile --error --metrics=off' }
        }
        stage('Dependencies') {
          // Two sources: npm advisory DB (pnpm audit) and OSV (covers more ecosystems).
          steps {
            sh 'pnpm audit --audit-level high'
            sh 'osv-scanner scan --lockfile=pnpm-lock.yaml'
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Build the images once. Provenance + SBOM attestations are attached so the
    // origin and contents of every image can be checked later.
    // -------------------------------------------------------------------------
    stage('Build images') {
      when { expression { env.IS_ROLLBACK == 'false' } }
      steps {
        sh '''
          set -euo pipefail
          docker buildx build -f apps/api/Dockerfile -t thaala-api:${IMAGE_TAG} --provenance=true --sbom=true --load .
          docker buildx build -f apps/web/Dockerfile -t thaala-web:${IMAGE_TAG} --provenance=true --sbom=true --load .
        '''
      }
    }

    // -------------------------------------------------------------------------
    // Image vulnerability scan + SBOM archive. Fails only on HIGH/CRITICAL issues
    // that already have a fix, so we are not blocked by unpatched upstream CVEs.
    // -------------------------------------------------------------------------
    stage('Scan images') {
      when { expression { env.IS_ROLLBACK == 'false' } }
      steps {
        sh '''
          set -euo pipefail
          mkdir -p reports
          for img in thaala-api thaala-web; do
            trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed --no-progress "$img:${IMAGE_TAG}"
            syft "$img:${IMAGE_TAG}" -o spdx-json > "reports/${img}-sbom.spdx.json"
          done
        '''
        archiveArtifacts artifacts: 'reports/*-sbom.spdx.json', fingerprint: true
      }
    }

    // -------------------------------------------------------------------------
    // Push to the STAGING ECR. Only main and release tags publish images;
    // PR builds stop after scanning.
    // -------------------------------------------------------------------------
    stage('Push to ECR (staging)') {
      when { allOf { expression { env.IS_ROLLBACK == 'false' }; anyOf { branch 'main'; buildingTag() } } }
      steps {
        sh '''
          set -euo pipefail
          # Assume the staging deploy role using the agent's own IAM identity (no stored keys).
          eval "$(scripts/ci/assume-role.sh "$STAGING_ROLE_ARN" jenkins-${BUILD_NUMBER})"
          registry="${STAGING_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
          aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$registry"
          for img in thaala-api thaala-web; do
            docker tag "$img:${IMAGE_TAG}" "$registry/$img:${IMAGE_TAG}"
            docker push "$registry/$img:${IMAGE_TAG}"
          done
          docker logout "$registry"
        '''
      }
    }

    // -------------------------------------------------------------------------
    // STAGING: migrate first (expand-only migrations), then roll out services.
    // -------------------------------------------------------------------------
    stage('Deploy staging') {
      when { anyOf { branch 'main'; buildingTag(); expression { env.IS_ROLLBACK == 'true' } } }
      steps {
        sh '''
          set -euo pipefail
          eval "$(scripts/ci/assume-role.sh "$STAGING_ROLE_ARN" jenkins-${BUILD_NUMBER})"
          registry="${STAGING_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
          # Skip migrations on rollback: the schema is expand-only, so old code still works.
          if [ "$IS_ROLLBACK" = "false" ]; then
            scripts/ci/run-migrations.sh thaala-staging thaala-api "$registry/thaala-api:${IMAGE_TAG}"
          fi
          scripts/ci/deploy-ecs.sh thaala-staging thaala-api    api    "$registry/thaala-api:${IMAGE_TAG}"
          scripts/ci/deploy-ecs.sh thaala-staging thaala-worker worker "$registry/thaala-api:${IMAGE_TAG}"
          scripts/ci/deploy-ecs.sh thaala-staging thaala-web    web    "$registry/thaala-web:${IMAGE_TAG}"
        '''
      }
    }

    stage('Smoke test staging') {
      when { anyOf { branch 'main'; buildingTag(); expression { env.IS_ROLLBACK == 'true' } } }
      steps {
        sh 'scripts/ci/smoke-test.sh "https://staging.${THAALA_DOMAIN}" "https://api.staging.${THAALA_DOMAIN}"'
      }
    }

    // -------------------------------------------------------------------------
    // PROD: only for release tags (or an explicit rollback), only after a human
    // in the release-managers group approves.
    // -------------------------------------------------------------------------
    stage('Approve production') {
      when { anyOf { buildingTag(); expression { env.IS_ROLLBACK == 'true' } } }
      steps {
        timeout(time: 24, unit: 'HOURS') {
          input message: "Deploy ${env.IMAGE_TAG} to PRODUCTION?", ok: 'Deploy', submitter: 'release-managers'
        }
      }
    }

    stage('Deploy production') {
      when { anyOf { buildingTag(); expression { env.IS_ROLLBACK == 'true' } } }
      steps {
        sh '''
          set -euo pipefail
          # 1) Copy the exact staging-tested images into the prod registry (no rebuild).
          scripts/ci/promote-image.sh "$STAGING_ROLE_ARN" "$PROD_ROLE_ARN" "$STAGING_ACCOUNT" "$PROD_ACCOUNT" thaala-api "${IMAGE_TAG}"
          scripts/ci/promote-image.sh "$STAGING_ROLE_ARN" "$PROD_ROLE_ARN" "$STAGING_ACCOUNT" "$PROD_ACCOUNT" thaala-web "${IMAGE_TAG}"

          # 2) Migrate, then roll out, in the prod account.
          eval "$(scripts/ci/assume-role.sh "$PROD_ROLE_ARN" jenkins-${BUILD_NUMBER})"
          registry="${PROD_ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
          if [ "$IS_ROLLBACK" = "false" ]; then
            scripts/ci/run-migrations.sh thaala-prod thaala-api "$registry/thaala-api:${IMAGE_TAG}"
          fi
          scripts/ci/deploy-ecs.sh thaala-prod thaala-api    api    "$registry/thaala-api:${IMAGE_TAG}"
          scripts/ci/deploy-ecs.sh thaala-prod thaala-worker worker "$registry/thaala-api:${IMAGE_TAG}"
          scripts/ci/deploy-ecs.sh thaala-prod thaala-web    web    "$registry/thaala-web:${IMAGE_TAG}"
        '''
        sh 'scripts/ci/smoke-test.sh "https://${THAALA_DOMAIN}" "https://api.${THAALA_DOMAIN}"'
      }
    }
  }

  post {
    // Tell the team what happened. The webhook URL is a masked Jenkins credential.
    failure {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_URL')]) {
        sh '''curl -fsS -X POST -H 'Content-Type: application/json' \
          --data "{\\"text\\":\\"❌ Thaala ${JOB_NAME} #${BUILD_NUMBER} failed (${IMAGE_TAG}). ${BUILD_URL}\\"}" "$SLACK_URL" || true'''
      }
    }
    success {
      withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_URL')]) {
        sh '''curl -fsS -X POST -H 'Content-Type: application/json' \
          --data "{\\"text\\":\\"✅ Thaala ${JOB_NAME} #${BUILD_NUMBER} passed (${IMAGE_TAG}).\\"}" "$SLACK_URL" || true'''
      }
    }
    // Always clean up local images and the workspace so nothing sensitive lingers on the agent.
    cleanup {
      sh 'docker image rm -f thaala-api:${IMAGE_TAG} thaala-web:${IMAGE_TAG} >/dev/null 2>&1 || true'
      cleanWs()
    }
  }
}
