BUILD := _build
SPEC  := docs/spec/data
PORT  ?= 8000
CONTEXT ?= dev
NETLIFY_BIN := $(shell p=$$(command -v netlify 2>/dev/null); if [ -f "$$p" ] && [ -x "$$p" ]; then printf '%s' "$$p"; fi)
NETLIFY ?= $(if $(NETLIFY_BIN),$(NETLIFY_BIN),npx --yes --package=netlify-cli@27.5.0 netlify)

.PHONY: build serve test clean

build:
	mkdir -p $(BUILD)/data $(BUILD)/assets
	cp src/index.html src/*.js $(BUILD)/
	cp $(SPEC)/*.json $(BUILD)/data/
	cp assets/*.json assets/*.png $(BUILD)/assets/

serve: build
	$(NETLIFY) dev --dir $(BUILD) --port $(PORT) --context $(CONTEXT) --no-open

test:
	node test/render_test.js
	node test/world_test.js
	node test/player_test.js
	node test/talk_test.js
	node test/time_test.js
	node test/shell_test.js
	node test/audio_test.js
	node test/input_test.js
	node test/session_test.js
	node test/github_test.mjs
	node test/replay_test.js intro
	node test/replay_test.js quest

clean:
	rm -rf $(BUILD)
