BUILD := _build
SPEC  := docs/spec/data
PORT  ?= 8000

.PHONY: build serve test clean

build:
	mkdir -p $(BUILD)/data $(BUILD)/assets
	cp src/index.html src/*.js $(BUILD)/
	cp $(SPEC)/*.json $(BUILD)/data/
	cp assets/*.json assets/*.png $(BUILD)/assets/

serve: build
	python3 -m http.server -d $(BUILD) $(PORT)

test:
	node test/render_test.js
	node test/talk_test.js
	node test/time_test.js
	node test/shell_test.js
	node test/replay_test.js intro
	node test/replay_test.js quest

clean:
	rm -rf $(BUILD)
