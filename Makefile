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
NODE_TEST := timeout $(TEST_TIMEOUT) node

PY ?= $(HOME)/.venvs/claude/bin/python
BTR_URL ?= http://localhost:$(PORT)

.PHONY: build serve release test browser-test poster screenshot clean

node_modules/.package-lock.json: package.json package-lock.json
	npm ci --ignore-scripts --no-audit --no-fund

build: node_modules/.package-lock.json
	mkdir -p $(BUILD)/data $(BUILD)/assets
	cp src/*.js src/*.css $(BUILD)/
	node tools/build-site.mjs $(BUILD)
	cp $(SPEC)/*.json $(BUILD)/data/
	cp assets/*.json assets/*.png assets/*.woff $(BUILD)/assets/
	cp assets/*.ttf assets/*-OFL.txt $(BUILD)/assets/
	mkdir -p $(BUILD)/assets/box && cp assets/box/* $(BUILD)/assets/box/

release:
	$(PYTHON) tools/release.py --iso "$(ISO)" --output "$(RELEASE)"

serve: build
	@if curl -sf -o /dev/null $(BTR_URL)/; then echo "already serving $(BUILD) at $(BTR_URL); a new build is picked up as is"; else \
	CHOKIDAR_USEPOLLING=$(CHOKIDAR_USEPOLLING) CHOKIDAR_INTERVAL=$(CHOKIDAR_INTERVAL) \
	$(NETLIFY) dev --dir $(BUILD) --port $(PORT) --context $(CONTEXT) --no-open; fi

test:
	timeout $(TEST_TIMEOUT) $(PYTHON) -m unittest discover -s test -p 'release_test.py'
	$(NODE_TEST) test/site_test.js
	$(NODE_TEST) test/log_test.js
	$(NODE_TEST) test/fit_test.js
	$(NODE_TEST) test/render_test.js
	$(NODE_TEST) test/world_test.js
	$(NODE_TEST) test/map_test.js
	$(NODE_TEST) test/options_test.js
	$(NODE_TEST) test/player_test.js
	$(NODE_TEST) test/talk_test.js
	$(NODE_TEST) test/time_test.js
	$(NODE_TEST) test/shell_test.js
	$(NODE_TEST) test/audio_test.js
	$(NODE_TEST) test/input_test.js
	$(NODE_TEST) test/menu_test.js
	$(NODE_TEST) test/gamepad_test.js
	$(NODE_TEST) test/session_test.js
	$(NODE_TEST) test/rewind_test.js
	$(NODE_TEST) test/progress_test.js
	$(NODE_TEST) tools/record-fixtures.mjs --check
	$(NODE_TEST) test/win_replay_test.js
	$(NODE_TEST) test/github_test.mjs
	$(NODE_TEST) test/replay_test.js intro
	$(NODE_TEST) test/replay_test.js quest
	@echo "make test: all passed"

screenshot: build
	$(PY) tools/shot.py --url $(BTR_URL)/ --width 1100 --height 850 --crt --select '#screen' --keys ArrowLeft --wait 3000 assets/box/screen.png '?room=B8'
	cp assets/box/screen.png $(BUILD)/assets/box/

poster:
	$(PY) tools/poster_map.py

browser-test: build
	@for t in test/browser_*.py; do BTR_URL=$(BTR_URL) $(PY) $$t || exit 1; done

clean:
	rm -rf $(BUILD)
