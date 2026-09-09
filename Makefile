.DEFAULT_GOAL := build
BUILD := _build
SPEC  := docs/spec/data
PORT  ?= 8000
CONTEXT ?= dev
NETLIFY_BIN := $(shell p=$$(command -v netlify 2>/dev/null); if [ -f "$$p" ] && [ -x "$$p" ]; then printf '%s' "$$p"; fi)
NETLIFY ?= $(if $(NETLIFY_BIN),$(NETLIFY_BIN),npx --yes --package=netlify-cli@27.5.0 netlify)

PY ?= $(HOME)/.venvs/claude/bin/python
BTR_URL ?= http://localhost:$(PORT)

.PHONY: build serve test browser-test poster screenshot clean

node_modules/.package-lock.json: package.json package-lock.json
	npm ci --ignore-scripts --no-audit --no-fund

build: node_modules/.package-lock.json
	mkdir -p $(BUILD)/data $(BUILD)/assets
	cp src/*.js src/*.css $(BUILD)/
	node tools/build-site.mjs $(BUILD)
	cp $(SPEC)/*.json $(BUILD)/data/
	cp assets/*.json assets/*.png $(BUILD)/assets/
	mkdir -p $(BUILD)/assets/box && cp assets/box/* $(BUILD)/assets/box/

serve: build
	@if curl -sf -o /dev/null $(BTR_URL)/; then echo "already serving $(BUILD) at $(BTR_URL); a new build is picked up as is"; else \
	$(NETLIFY) dev --dir $(BUILD) --port $(PORT) --context $(CONTEXT) --no-open; fi

test:
	node test/site_test.js
	node test/log_test.js
	node test/fit_test.js
	node test/render_test.js
	node test/world_test.js
	node test/map_test.js
	node test/help_test.js
	node test/options_test.js
	node test/player_test.js
	node test/talk_test.js
	node test/time_test.js
	node test/shell_test.js
	node test/audio_test.js
	node test/input_test.js
	node test/gamepad_test.js
	node test/session_test.js
	node test/github_test.mjs
	node test/replay_test.js intro
	node test/replay_test.js quest
	@echo "make test: all passed"

screenshot: build
	$(PY) tools/shot.py --url $(BTR_URL)/ --width 1000 --height 750 --select '#canvas-box' --keys ArrowLeft --wait 3000 assets/box/screen.png '?room=B8'
	cp assets/box/screen.png $(BUILD)/assets/box/

poster:
	$(PY) tools/poster_map.py

browser-test: build
	@for t in test/browser_*.py; do BTR_URL=$(BTR_URL) $(PY) $$t || exit 1; done

clean:
	rm -rf $(BUILD)
