# ORO Makefile — thin wrappers over docker compose so you don't memorize flags.
.PHONY: help up down logs ps build migrate seed shell-db backup-db restore-db \
        backup-all restore-all dev

COMPOSE := docker compose
# Production = base stack + hardening overlay (limits, log rotation, no-new-privileges).
COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml
COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

up: ## Production stack up (background) — base + hardening overlay
	$(COMPOSE_PROD) up -d --build

dev: ## Dev stack up — mailpit + minio + seed on boot
	$(COMPOSE_DEV) up --build

down: ## Production stack down (keeps volumes)
	$(COMPOSE) down

down-v: ## DANGER: stop + delete volumes (wipes DB + docs)
	$(COMPOSE) down -v

logs: ## Tail logs from all services
	$(COMPOSE) logs -f --tail=100

ps: ## Show running containers
	$(COMPOSE) ps

build: ## Build the web/worker image without starting it
	$(COMPOSE) build web

migrate: ## Run pending Prisma migrations against the running db
	$(COMPOSE) exec web ./node_modules/.bin/prisma migrate deploy

seed: ## Run the idempotent seed against the running db
	$(COMPOSE) exec web node ./dist-worker/worker/seed.js

shell-db: ## psql into the running database
	$(COMPOSE) exec db psql -U $$POSTGRES_USER -d $$POSTGRES_DB

backup-db: ## pg_dump the database into ./backups/$(date)/oro.sql.gz
	@mkdir -p backups
	$(COMPOSE) exec -T db pg_dump -U $$POSTGRES_USER -d $$POSTGRES_DB | gzip > backups/oro-$$(date -u +%Y%m%dT%H%M%SZ).sql.gz
	@echo "Backup written under ./backups/"

restore-db: ## Restore DB only from FILE=backups/oro-YYYYMMDDTHHMMSSZ.sql.gz
	@test -n "$(FILE)" || (echo "usage: make restore-db FILE=backups/oro-...sql.gz" && exit 1)
	gunzip -c $(FILE) | $(COMPOSE) exec -T db psql -U $$POSTGRES_USER -d $$POSTGRES_DB

backup-all: ## Full backup: db + encrypted docs + secrets (via deploy/backup.sh)
	./deploy/backup.sh

restore-all: ## Restore db + docs from DIR=backups/<timestamp> (a backup-all folder)
	@test -n "$(DIR)" || (echo "usage: make restore-all DIR=backups/<timestamp>" && exit 1)
	@set -a; . ./.env; set +a; \
	echo "restoring database from $(DIR)/db.sql.gz…"; \
	gunzip -c $(DIR)/db.sql.gz | $(COMPOSE) exec -T db psql -U $$POSTGRES_USER -d $$POSTGRES_DB; \
	echo "restoring documents from $(DIR)/docs.tar.gz…"; \
	$(COMPOSE) exec -T web sh -c 'rm -rf /data/docs/* && tar -xzf - -C /data' < $(DIR)/docs.tar.gz
	@echo "restored db + docs from $(DIR)"
