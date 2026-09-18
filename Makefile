.DEFAULT_GOAL := build
BUILD := _build
SPEC  := docs/spec/data
PORT  ?= 8000
CONTEXT ?= dev
PYTHON ?= python3
ISO ?= iso
RELEASE ?= dist/below-the-root-preservation.zip
NETLIFY_BIN := $(shell p=$$(command -v netlify 2>/dev/null); if [ -f "$$p" ] && [ -x "$$p" ]; then printf '%s' "$$p"; fi)
NETLIFY ?= $(if $(NETLIFY_BIN),$(NETLIFY_BIN),npx --yes --package=netlify-cli@27.5.0 netlify)
# Poll by default: shared Linux users can exhaust their inotify instance limit.
CHOKIDAR_USEPOLLING ?= 1
CHOKIDAR_INTERVAL ?= 500

TEST_TIMEOUT ?= 60

PY ?= $(HOME)/.venvs/claude/bin/python
BTR_URL ?= http://localhost:$(PORT)

.PHONY: build serve release test browser-test poster screenshot clean install-hooks

install-hooks:
	git config core.hooksPath .githooks

node_modules/.package-lock.json: package.json package-lock.json
	npm ci --ignore-scripts --no-audit --no-fund

build: node_modules/.package-lock.json
	mkdir -p $(BUILD)/data $(BUILD)/assets
	cp src/*.js src/*.css $(BUILD)/
	node tools/build-site.mjs $(BUILD)
	cp $(SPEC)/*.json $(BUILD)/data/
	cp assets/*.json assets/*.png assets/*.woff $(BUILD)/assets/
	cp assets/*.ttf assets/*-OFL.txt $(BUILD)/assets/
	cp assets/*.otf assets/*-LICENSE.txt $(BUILD)/assets/
	mkdir -p $(BUILD)/assets/box && cp assets/box/* $(BUILD)/assets/box/

release:
	$(PYTHON) tools/release.py --iso "$(ISO)" --output "$(RELEASE)"

serve: build
	@if curl -sf -o /dev/null $(BTR_URL)/; then echo "already serving $(BUILD) at $(BTR_URL); a new build is picked up as is"; else \
	CHOKIDAR_USEPOLLING=$(CHOKIDAR_USEPOLLING) CHOKIDAR_INTERVAL=$(CHOKIDAR_INTERVAL) \
	$(NETLIFY) dev --dir $(BUILD) --port $(PORT) --context $(CONTEXT) --no-open; fi

test:
	@out=$$(mktemp); status=0; trap 'rm -f "$$out"' EXIT HUP INT TERM; \
	unset $$(git rev-parse --local-env-vars); \
	timeout $(TEST_TIMEOUT) node --test --test-reporter=./tools/test-reporter.mjs test/*_test.js test/*_test.mjs >"$$out" 2>&1 || { status=$$?; echo "Node tests failed (exit $$status)" >>"$$out"; }; \
	timeout $(TEST_TIMEOUT) $(PYTHON) -m unittest discover -v -s test -p 'release_test.py' >>"$$out" 2>&1 || { status=$$?; echo "Python tests failed (exit $$status)" >>"$$out"; }; \
	if [ $$status -ne 0 ]; then cat "$$out"; exit $$status; fi; \
	awk '/^(pass|skip|todo): / { print } \
	  /^test_.* \.\.\. ok$$/ { sub(/ \.\.\. ok$$/, ""); print "pass: " $$0 } \
	  /^test_.* \.\.\. skipped / { print "skip: " $$0 }' "$$out"

screenshot: build
	$(PY) tools/shot.py --url $(BTR_URL)/ --width 1100 --height 850 --crt --select '#screen' --keys ArrowLeft --wait 3000 assets/box/screen.png '?room=B8'
	cp assets/box/screen.png $(BUILD)/assets/box/

poster:
	$(PY) tools/poster_map.py

browser-test: build
	@if grep -rnE 'wait_for_timeout|setTimeout\(r' test/; then echo "Use deterministic waits or fake clocks in tests"; exit 1; fi
	@for t in $(filter-out test/browser_release_test.py,$(wildcard test/browser_*.py)); do BTR_URL=$(BTR_URL) $(PY) $$t || exit 1; done

clean:
	rm -rf $(BUILD)
