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

clean:
	rm -rf $(BUILD)
