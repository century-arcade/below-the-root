# Code map

Every named address in the original, against the port.  The labels are
`disasm/labels/*.json`, the names the disassembly and `docs/*.md` use; the
port column is the module and function, or the state field, that plays
the part in `src/` (`disasm/port_map.json`), and is empty where the port
has no counterpart -- jump-table thunks (`jt_*`), tables the spec turned
into JSON, SID and sprite plumbing.  `docs/*.md` explain the routines in
C64 terms; `docs/spec/` is the behaviour with no addresses at all.

Regenerate with `python3 tools/code_map.py` after changing a label or the
port map.

## Zero page and game state

| address | label | port | note |
|---|---|---|---|
| `$0098` | `in_dx` | input read: dx |  |
| `$0099` | `in_dy` | input read: dy |  |
| `$009A` | `in_ndirs` |  |  |
| `$00A8` | `reverse_video` |  |  |
| `$00A9` | `demo_ptr` |  |  |
| `$00C2` | `kiniport_index` |  |  |
| `$00C4` | `fatigue_cause` |  |  |
| `$00C5` | `fatigue` | player.fatigue |  |
| `$00C8` | `dream_state` | state.dream (clock.DREAM) | 0 normal, 1 rested in room $0009, $FF in the other world |
| `$00C9` | `leap_hover` | player.hover |  |
| `$00CA` | `lamp_index` | state.lamp.object |  |
| `$00CB` | `lamp_fuel` | state.lamp.fuel (world.burnLamp) | honeylamp fuel, one per room change; 0 destroys the lamp |
| `$00CC` | `take_permission` | state.offered | an NPC or merchant offered class $09EF; TAKE spends it |
| `$00CD` | `door_permission` | state.paid |  |
| `$00CE` | `falla_key_revealed` | state.fallaKey |  |
| `$00D1` | `creature_hit` | state.stop {reason: 'ambush'} |  |
| `$00D2` | `cycle_first` |  |  |
| `$00D3` | `saved_room_lo` | save.js |  |
| `$00D4` | `saved_room_hi` | save.js |  |
| `$00D5` | `character` | state.character |  |
| `$00D6` | `menu_item` | state.menuSel |  |
| `$00D7` | `quest_active` | state.quest |  |
| `$00D8` | `attract_state` | state.attract |  |
| `$00D9` | `charsel_saved` |  |  |
| `$00DA` | `storage_item` | state.disk.op |  |
| `$00DB` | `quest_slot` | state.disk.slot |  |
| `$00DC` | `vision_count` | state.visions |  |
| `$00DD` | `pense_msg_count` | state.animalsPensed |  |
| `$00DE` | `quest_time_up` | state.timeUp |  |
| `$00DF` | `spirit_bell_rang` | state.stop {reason: 'bell'} |  |
| `$09E0` | `blk_creature` | data.creatureByRoom (creatures.json) |  |
| `$09E1` | `blk_npc_gate` |  |  |
| `$09E2` | `blk_npc_spread` |  |  |
| `$09E3` | `blk_npc_col` |  |  |
| `$09E4` | `blk_npc_row` |  |  |
| `$09E5` | `blk_npc_turn_a` |  |  |
| `$09E6` | `blk_npc_turn_b` |  |  |
| `$09E7` | `blk_speak_pass1` |  |  |
| `$09E8` | `blk_speak_pass2` |  |  |
| `$09E9` | `blk_emotion_pass` |  |  |
| `$09EA` | `blk_message_pass` |  |  |
| `$09EB` | `blk_speak_fail1` |  |  |
| `$09EC` | `blk_speak_fail2` |  |  |
| `$09ED` | `blk_emotion_fail` |  |  |
| `$09EE` | `blk_message_fail` |  |  |
| `$09EF` | `blk_gift_class` |  |  |
| `$09F0` | `blk_npc_id` |  |  |
| `$09F1` | `blk_npc_kind` | creature.def.kind; door.lock |  |
| `$0A04` | `game_active` | state.active |  |
| `$0A05` | `exit_dir` | state.stop {reason: 'edge', dir} |  |
| `$0A06` | `step_period` | player.period |  |
| `$0A08` | `step_counter` | player.counter |  |
| `$0A09` | `fall_rows` | player.fallen | rows fallen; $0A or more forces the knock-down at $A339 |
| `$0A0B` | `last_col` | player.lastGood.col |  |
| `$0A0C` | `last_row` | player.lastGood.row |  |
| `$0A0D` | `door_req` | state.stop {reason: 'door', n} |  |
| `$0A0E` | `indoor_flag` | player.indoors |  |
| `$0A0F` | `tileset_shown` | room.tileset (video.drawRoom) |  |
| `$0A10` | `player_col` | player.col |  |
| `$0A18` | `player_row` | player.row |  |
| `$0A20` | `tile_at` | player.sample().own |  |
| `$0A21` | `tile_left` | player.sample().left |  |
| `$0A22` | `tile_right` | player.sample().right |  |
| `$0A23` | `tile_below` | player.sample().floor |  |
| `$0A24` | `tile_dnleft` | player.sample().downLeft |  |
| `$0A25` | `tile_dnright` | player.sample().downRight |  |
| `$0A26` | `tile_up1` | player.sample() |  |
| `$0A27` | `tile_up2` | player.sample() |  |
| `$0A28` | `tile_head` | player.sample().head |  |
| `$0A29` | `tile_up2left` | player.sample() |  |
| `$0A2A` | `tile_up2right` | player.sample() |  |
| `$0A2C` | `tp_support` | world.isSupport |  |
| `$0A2D` | `tp_solid` | world.isSolid |  |
| `$0A2E` | `tp_climb` | world.isClimbable |  |
| `$0A30` | `leaping` | player.leaping |  |
| `$0A31` | `leap_phase` | player.leapPhase |  |
| `$0A34` | `knockdown_ctr` | player.knockdown |  |
| `$0A35` | `gliding` | player.gliding |  |
| `$0A37` | `facing` | player.facing |  |
| `$0A38` | `walk_phase` | player.stride |  |
| `$0A39` | `walk_frame` | player.strideAlt |  |
| `$0A3A` | `knockdown_frame` | player.frameAlt |  |
| `$0A3B` | `climb_frame` | player.frameAlt |  |
| `$0A3C` | `running` | player.running |  |
| `$0A3D` | `crawling` | player.crawling |  |
| `$0A3E` | `stooping` | player.pose |  |
| `$0A3F` | `water_anim_frame` | video.drawRoom (water cycle) |  |
| `$0A49` | `water_anim_ctr` | video.drawRoom (water cycle) |  |
| `$0A4A` | `menu_req` | state.stop {reason: 'menu'} |  |
| `$0A4C` | `no_glide` | player.glideInhibited |  |
| `$0A4D` | `drowned` | state.stop {reason: 'drown'} |  |
| `$0A50` | `menu_col` | verbs.runMenu |  |
| `$0A51` | `menu_row` | verbs.runMenu |  |
| `$0A52` | `menu_col_new` | verbs.runMenu |  |
| `$0A53` | `menu_row_new` | verbs.runMenu |  |
| `$0A54` | `pick_index` | inventory.pickItem |  |
| `$0A55` | `pick_class` | inventory.pickItem |  |
| `$0A56` | `verb_tmp0` |  |  |
| `$0A57` | `verb_tmp1` |  |  |
| `$0A60` | `loaded_player` |  |  |
| `$0A61` | `time_of_day` | state.clock.hour |  |
| `$0A62` | `day` | state.clock.day |  |
| `$0A63` | `spirit_energy` | player.spiritEnergy |  |
| `$0A64` | `food` | player.food |  |
| `$0A65` | `rest` | player.rest |  |
| `$0A66` | `stamina` | player.stamina |  |
| `$0A67` | `spirit_limit` | player.spiritLimit |  |
| `$0A68` | `standing_kindar` | player.standingKindar |  |
| `$0A69` | `standing_erdling` | player.standingErdling |  |
| `$0A6A` | `food_max1` | player.foodCap |  |
| `$0A6B` | `rest_max1` | player.restCap |  |
| `$0A6C` | `carry_limit` | inventory.carryLimit |  |
| `$0A6D` | `nid_room_lo` | state.nidPlace |  |
| `$0A6E` | `nid_room_hi` | state.nidPlace |  |
| `$0A6F` | `nid_col` | state.nidPlace |  |
| `$0A70` | `nid_row` | state.nidPlace |  |
| `$0A78` | `clock_prescale` | clock.clockTick |  |
| `$0A79` | `clock_period` | clock.clockTick |  |
| `$0A7A` | `carried_weight` | inventory.weightCarried |  |
| `$0A80` | `npc_col` | state.creature.col |  |
| `$0A81` | `npc_row` | state.creature.row |  |
| `$0A82` | `npc_active` | state.creature |  |
| `$0A83` | `npc_gait` | creature.def.gait |  |
| `$0A84` | `npc_species` | creature.def.species |  |
| `$0A85` | `npc_dir` | state.creature.facing |  |
| `$0A86` | `npc_frame_ctr` | state.creature.countdown |  |
| `$0A87` | `npc_frame_period` |  |  |
| `$0A89` | `npc_tile_ahead` |  |  |
| `$0A8A` | `npc_tile_below` |  |  |
| `$0A8B` | `npc_step_phase` | state.creature.stride |  |
| `$0A8C` | `npc_frame_ofs` | state.creature.stepAlt |  |
| `$0A8D` | `npc_turned` | state.creature.turned |  |
| `$0A8E` | `npc_req_level` |  |  |
| `$0A8F` | `npc_req_stat` |  |  |
| `$0A90` | `demo_steps` | input.DemoInput.remaining |  |
| `$0A91` | `demo_joy` | input.DemoInput.value |  |
| `$0A93` | `music_v1_count` | audio.Speaker |  |
| `$0A94` | `music_v2_count` | audio.Speaker |  |
| `$0A95` | `music_on` | audio.Speaker (events {music}) |  |
| `$0A96` | `demo_next_room` | state.stop {reason: 'demo_room'} |  |
| `$0A97` | `demo_text_req` | state.stop {reason: 'demo_page'} |  |
| `$0AA0` | `joy_up` | input.decodeJoy |  |
| `$0AA1` | `joy_down` | input.decodeJoy |  |
| `$0AA2` | `joy_left` | input.decodeJoy |  |
| `$0AA3` | `joy_right` | input.decodeJoy |  |
| `$0AA4` | `joy_fire` | input.decodeJoy |  |
| `$0AA5` | `obj_bit_carried` |  | $20, the carried bit; the $0AA0 table doubles as the joystick masks |
| `$0AA6` | `obj_bit_exists` |  |  |
| `$0AA7` | `bit7_mask` |  |  |
| `$0B00` | `row_addr_lo` |  |  |
| `$0B20` | `row_addr_hi` |  |  |
| `$0B40` | `col_to_x` |  |  |
| `$0B70` | `row_to_y` |  |  |
| `$0D00` | `obj_room_lo` | state.objects[].room |  |
| `$0E00` | `obj_col` | state.objects[].col |  |
| `$0F00` | `obj_flags` | state.objects[] {row, exists, carried} | bit 7 room hi, bit 6 exists, bit 5 carried, bits 0-4 screen row |
| `$0F01` | `obj_spirit_lamp` |  |  |
| `$0F58` | `obj_class_shuba` | inventory.CLASS.shuba |  |
| `$0F6C` | `obj_class_token` | inventory.mintToken |  |
## Save image, creature flags

| address | label | port | note |
|---|---|---|---|
| `$2000` | `save_objects` | save.exportSave / importSave |  |
| `$2300` | `npc_banished` | state.flags[].banished | bit 7 = struck with the wand of Befal; $2334/$2335 double as door locks |
| `$2334` | `gate_a_open` | world.gateLocked |  |
| `$2335` | `gate_b_open` | world.gateLocked |  |
| `$2380` | `npc_flags` | state.flags[] {day, gift, hour} | day last spoken (bits 0-6), gift given (bit 7), ambush time slot (bits 0-4) |
| `$2400` | `save_vars` | save.exportSave / importSave |  |
| `$2500` | `save_zp` | save.exportSave / importSave |  |
## Music driver (musiclow)

| address | label | port | note |
|---|---|---|---|
| `$2800` | `jt_music_play` |  |  |
| `$2803` | `jt_music_tick` |  |  |
| `$2806` | `music_play` | audio.startTune / Speaker.playTune | music_play: A = tune 0-10; both voices read one shared stream |
| `$2844` | `tune_ptr_lo` |  |  |
| `$284F` | `tune_ptr_hi` |  |  |
| `$285A` | `music_tick` | audio.planTune (whole tune scheduled up front) |  |
| `$286B` | `music_v1_next` |  |  |
| `$289C` | `music_v2_next` |  |  |
| `$28CB` | `music_ptr_inc` |  |  |
| `$28D2` | `tune_data` | music.json |  |
| `$2B37` | `note_freq_lo` | music.json notes | descending chromatic E6..D3, index 39 = freq 0 = rest |
| `$2B5F` | `note_freq_hi` | music.json notes |  |
| `$2B87` | `linker_symbols` |  | leftover build symbol table, not read by any code |
## Demo scripts (demolow)

| address | label | port | note |
|---|---|---|---|
| `$2C00` | `demo_text_page` | game.showPage | A = page 1-4 prints, 5 clears; A > 4 falls through to page 4 |
| `$2F00` | `demo_script_intro` | demo.json intro | intro script, $2F00-$2F96; ends C3 E4 -> room 228 |
| `$30C8` | `demo_next_byte` | input.DemoInput.read |  |
| `$3100` | `demo_script_quest` | demo.json quest | sample-quest script, $3100-$330A; ends C3 9D -> room 157 |
## Menus, disk, dialog verbs (gamelow)

| address | label | port | note |
|---|---|---|---|
| `$3400` | `jt_main_menu` |  |  |
| `$3406` | `main_menu_entry` | shell.openMenu | $D8: 0 = cold start (run attract), >0 = show menu, <0 = second attract screen |
| `$3420` | `menu_setup` | shell.mainMenu |  |
| `$3447` | `main_menu` | shell.mainMenu |  |
| `$3450` | `menu_input_loop` | shell.mainMenu |  |
| `$347F` | `menu_fire` | shell.mainMenu |  |
| `$3497` | `menu_start_game` | shell.characterSelect |  |
| `$34A3` | `charsel_draw` | shell.drawRecord |  |
| `$368A` | `charsel_input` | shell.nextPush |  |
| `$36AE` | `charsel_fire` | shell.characterSelect |  |
| `$36BE` | `start_quest` | game.startQuest |  |
| `$3706` | `menu_continue` | shell.resume |  |
| `$374A` | `disk_init_drive` |  |  |
| `$3768` | `scratch_quest_file` |  |  |
| `$3842` | `menu_disk_storage` | shell.diskStorage |  |
| `$3845` | `storage_draw` | shell.drawStorageLine |  |
| `$3893` | `storage_input` | shell.pickAlong |  |
| `$38C2` | `slot_draw` | shell.drawSlots |  |
| `$38FE` | `slot_input` | shell.pickAlong |  |
| `$3915` | `storage_go` | shell.diskStorage |  |
| `$3968` | `save_game` | save.exportSave | state vector $2000-$257F = $0D00-$0FFF + live $2300-$23FF + $0A00-$0AFF + zp $80-$FF |
| `$39C6` | `load_game` | save.importSave |  |
| `$3A19` | `storage_item_col` |  |  |
| `$3A1C` | `storage_item_len` |  |  |
| `$3A1F` | `slot_item_col` |  |  |
| `$3A24` | `str_save_name` |  | SAVE writes '0:QUESTn'; LOAD opens the same name from $3A26 without the '0:' |
| `$3A2B` | `save_name_digit` |  |  |
| `$3A2D` | `menu_sample_quest` | shell.sampleQuest |  |
| `$3A38` | `draw_main_menu` | shell.drawMainMenu |  |
| `$3A89` | `highlight_menu_item` | panel.print (reverse) |  |
| `$3A9D` | `menu_item_col` |  |  |
| `$3AA1` | `load_player_file` |  |  |
| `$3B10` | `str_player_name` |  |  |
| `$3B16` | `player_name_digit` |  |  |
| `$3B18` | `disk_io_prologue` |  |  |
| `$3B2E` | `prompt_side2` |  |  |
| `$3B5D` | `prot_record` |  |  |
| `$3C00` | `jt_print_message` |  |  |
| `$3C03` | `jt_verb_speak` |  |  |
| `$3C06` | `jt_verb_pense` |  |  |
| `$3C09` | `jt_verb_buy` |  |  |
| `$3C0C` | `jt_verb_sell` |  |  |
| `$3C0F` | `jt_verb_offer` |  |  |
| `$3C12` | `jt_play_random_tune` |  |  |
| `$3C15` | `print_message` | dialog.tell |  |
| `$3C48` | `verb_speak` | dialog.speak |  |
| `$3D38` | `play_random_tune` | audio.startTune(state, 'random') |  |
| `$3D4E` | `find_gift_item` | dialog.givesItem | the gift is any object still lying on the ground in this room |
| `$3DA9` | `gain_spirit_power` | dialog.gainSpirit |  |
| `$3E13` | `vision_sequence` | dialog.pense |  |
| `$401C` | `skill_msg_offset` |  |  |
| `$4022` | `skill_names` |  |  |
| `$407B` | `verb_pense` | dialog.pense |  |
| `$4194` | `verb_buy` | dialog.buy |  |
| `$4234` | `verb_sell` | dialog.sell |  |
| `$4329` | `item_sellable` | dialog.sell | classes a merchant will buy: honeylamp, food, shuba, beak, berries, rope |
| `$4338` | `require_merchant` | dialog.merchant |  |
| `$4364` | `npc_adjacent` | creatures.creatureInReach |  |
| `$439A` | `msg_no_response_speak` |  |  |
| `$43AE` | `msg_no_response_message` |  |  |
| `$43C2` | `npc_gate` | dialog.passes | $0A68/$0A69 are set once by init_character and never change |
| `$43CC` | `verb_offer` | dialog.offer |  |
| `$449C` | `offer_to_raamo` | dialog.win | Raamo takes a shuba (class 7) or a vine rope (class $0B) |
| `$44C3` | `gate_grant_entry` | dialog.offer |  |
| `$4500` | `msg_table` | messages.json |  |
## Utilities, spirit skills, screen

| address | label | port | note |
|---|---|---|---|
| `$800C` | `jt_to_decimal` |  |  |
| `$8012` | `jt_delay` |  |  |
| `$8030` | `jt_memcpy_pages` |  |  |
| `$8033` | `jt_memclr_pages` |  |  |
| `$813E` | `to_decimal` | verbs.paintStatus | 16-bit X/Y -> five ASCII digits in $92-$96 |
| `$8168` | `dec_pow10_lo` |  |  |
| `$816D` | `dec_pow10_hi` |  |  |
| `$81B7` | `delay_xy` |  |  |
| `$81BE` | `delay_xy_slow` |  |  |
| `$8260` | `memcpy_pages` |  |  |
| `$8279` | `memclr_pages` |  |  |
| `$8300` | `kiniport_cursor_show` | state.pointer (verbs.point) |  |
| `$8318` | `kiniport_cursor_hide` | state.pointer (verbs.point) |  |
| `$8321` | `verb_inventory` | verbs.inventory |  |
| `$8388` | `msg_lack_spirit_skill` |  |  |
| `$83AA` | `msg_need_spirit_energy` |  |  |
| `$8403` | `jt_verb_inventory` |  |  |
| `$8406` | `jt_verb_heal` |  |  |
| `$8409` | `jt_verb_grunspreke` |  |  |
| `$840C` | `jt_verb_kiniport` |  |  |
| `$84AD` | `bit_masks` |  | copied to $0AA0-$0AA7, so `bit $0AA5` means `test bit 5 of A` |
| `$84B5` | `verb_heal` | verbs.heal |  |
| `$8510` | `verb_grunspreke` | verbs.grunspreke |  |
| `$85B8` | `verb_kiniport` | verbs.kiniport |  |
| `$8783` | `cursor_joystick_loop` | verbs.point |  |
| `$87BA` | `cursor_place_sprite` |  |  |
| `$8806` | `jt_build_text_font` |  |  |
| `$8B20` | `build_text_font` | data.makeCharset | builds the $D000 ASCII text font out of the character ROM |
| `$8C6D` | `blit_screen_dark` | world.isLit / video.drawRoom | rooms >= $180 go black unless the spirit lamp or a lit honeylamp |
| `$8CA0` | `place_objects` | world.paintScreen | the only room content that is not in the room block |
| `$8E76` | `quest_time_over` | game.timeOver |  |
## USE and CUT, room load, game loop, creatures

| address | label | port | note |
|---|---|---|---|
| `$9000` | `verb_use` | verbs.use |  |
| `$9077` | `item_usable` | verbs.use |  |
| `$9222` | `rope_span_probe` |  |  |
| `$9226` | `rope_span` | verbs.layRope |  |
| `$92FB` | `cut_tiles` | verbs.cut | clears cells matching $84 in two columns, five rows up; count in $0A57 |
| `$931B` | `cut_tile_column` |  |  |
| `$933A` | `wand_of_befal_hit` | creatures.banish | wand of befal: freeze the adjacent creature, at the cost of $0A67 |
| `$93C0` | `demo_finished` | game.resolveStop 'demo_room' / game.endDemo |  |
| `$93E2` | `clear_room_rows` |  |  |
| `$940B` | `clear_screen` |  |  |
| `$940E` | `clear_text_area` | panel.clearPanel |  |
| `$948A` | `recover_a_day` | clock.loseDay |  |
| `$9492` | `recover_day_msg` |  |  |
| `$9503` | `jt_clear_room_rows` |  |  |
| `$9506` | `jt_clear_text_rows` |  |  |
| `$9509` | `jt_clear_screen` |  |  |
| `$9515` | `jt_run_new_game` |  |  |
| `$9518` | `jt_resume_game` |  |  |
| `$952B` | `attract_start` | game.startDemo |  |
| `$954F` | `game_loop` | game.tick |  |
| `$9561` | `game_loop_tick` | game.tick |  |
| `$95B9` | `room_edge_load` | world.leaveByEdge |  |
| `$9632` | `game_loop_resume` | game.resolveStop |  |
| `$964A` | `load_room` | world.enterRoom | burn the honeylamp, then: indoor flag set -> load; else outdoor bit clear -> open air, no creature |
| `$9675` | `load_room_air` | world.openAir |  |
| `$96B9` | `door_lock_check` | world.gateLocked |  |
| `$9789` | `attract_intro_setup` | game.startDemo |  |
| `$97BB` | `reset_object_table` | game.newObjects |  |
| `$97C4` | `attract_quest_setup` | game.startDemo |  |
| `$9803` | `jt_spawn_creature` |  |  |
| `$9806` | `jt_creature_step` |  |  |
| `$980A` | `spawn_creature` | creatures.spawnCreature | runs on every room entry; copies 384 bytes of sprites each time |
| `$9887` | `copy_species_sprites` |  | 3 x 128 bytes to $FD00, bit-reversed + column-swapped to $FE80 |
| `$994F` | `species_sprite_lo` |  |  |
| `$995A` | `species_sprite_hi` |  |  |
| `$9965` | `sprite_dst_lo` |  |  |
| `$9968` | `sprite_dst_hi` |  |  |
| `$996B` | `sprite_mirror_lo` |  |  |
| `$996E` | `sprite_mirror_hi` |  |  |
| `$9971` | `creature_step` | creatures.creatureTick | creature AI, once per frame from irq_tick -- not per state step |
| `$9A06` | `creature_contact` | creatures.contact | species 8/9 only: writes $0A into $0A09 to request the knock-down |
| `$9A38` | `creature_turn_or_step` | creatures.turn / lift |  |
| `$9A68` | `turn_pause` |  | frames to wait after turning, indexed by gait $0A83 |
| `$9A94` | `creature_half_step` | creatures.plant |  |
| `$9AF4` | `step_period_slow` |  |  |
| `$9AF6` | `step_period_fast` |  |  |
| `$9AF8` | `walk_frame` |  | walk frame base $F4/$F6; +6 faces right, +$0A8C alternates |
| `$9AFA` | `creature_ambush` | creatures.ambush | $09F1 high nibble $E0: copies it to $D1 and drops out of the loop |
| `$9B37` | `place_creature_sprites` | creatures.creatureFigure |  |
| `$9B69` | `set_creature_frame` |  |  |
| `$9B71` | `set_creature_facing` |  |  |
## Player state machine

| address | label | port | note |
|---|---|---|---|
| `$9C00` | `jt_sample_neighbors` |  |  |
| `$9C03` | `jt_move_sprite` |  |  |
| `$9C06` | `jt_read_tile` |  |  |
| `$9C09` | `jt_tile_props` |  |  |
| `$9C0C` | `jt_swap_charset_banks` |  |  |
| `$9C0F` | `jt_draw_player` |  |  |
| `$9C12` | `jt_anim_water_char` |  |  |
| `$9C15` | `jt_init_character` |  |  |
| `$9C18` | `jt_quest_complete` |  |  |
| `$9C1C` | `swap_charset_banks` | video.drawRoom (charsets[room.tileset]) |  |
| `$9C43` | `anim_water_char` | video.drawRoom (water cycle) |  |
| `$9C6E` | `init_character` | game.applyCharacter |  |
| `$9CA3` | `char_record_ends` |  |  |
| `$9CA9` | `char_records` |  |  |
| `$9CFD` | `sample_neighbors` | player.sample | fills $0A20-$0A2A with the 11 cells around the player |
| `$9D20` | `neighbor_dx` |  |  |
| `$9D2B` | `neighbor_dy` |  |  |
| `$9D36` | `move_player_sprite` | video.drawFigure / figureOrigin |  |
| `$9D68` | `read_tile` | world.cell |  |
| `$9D90` | `tile_props` | world.tile (tiles.json) | tile code in A -> $0A2C support / $0A2D solid / $0A2E climbable |
| `$9DF6` | `draw_player` | player.idleFrame | resting pose only; the moving states set $C3F8 themselves |
| `$9E17` | `quest_complete` | dialog.win |  |
| `$9F80` | `spend_fatigue` | clock.spend |  |
| `$9FB3` | `check_spirit_bell` | player.js: state.stop {reason: 'bell'} | $0F00 index 0 is literal: class 0 has exactly one slot, the bell |
| `$A000` | `irq_tick` | game.tick | runs once per frame from the raster IRQ at line $DE |
| `$A02D` | `state_step` | player.step | one state step, every $0A06 frames |
| `$A07E` | `input_fire` | player.fireHeld |  |
| `$A0E7` | `input_nofire` | player.fireFree |  |
| `$A106` | `on_ground` | player.fireFree |  |
| `$A13D` | `vertical_input` | player.fireFree / climb |  |
| `$A167` | `ladder_column_snap` | world.ladderSnap | ladder halves $B4/$B7 and $B6/$B9 pull the player to the centre column |
| `$A1B1` | `commit_step` | player.afterMove(state, true) |  |
| `$A1B6` | `commit_move` | player.afterMove |  |
| `$A1CD` | `check_room_edge` | player.afterMove (edge) |  |
| `$A21C` | `leap_step` | player.leapStep |  |
| `$A2A3` | `leap_dy` | player.leapStep | leap dy by phase; index 0 is the JMP operand, phases start at 1 |
| `$A2A8` | `leap_start` | player.leap |  |
| `$A2FB` | `knockdown_anim` | player.knockdownStep |  |
| `$A337` | `knockdown_frames` |  |  |
| `$A339` | `knockdown_start` | player.startKnockdown |  |
| `$A361` | `showing_climb_frame` | player.fireHeld (FRAME.climb) |  |
| `$A370` | `try_glide` | player.fireHeld |  |
| `$A39A` | `glide_step` | player.glideStep |  |
| `$A3A8` | `glide_end` | player.endGlide | resting pose, sfx 2, then commit_step |
| `$A3EC` | `set_glide_sprite` | player FRAME.glide |  |
| `$A3F5` | `set_sprite_pair` |  |  |
| `$A3FD` | `stoop_pose` | player.stoopPose |  |
| `$A414` | `end_stoop_pose` | player.step |  |
| `$A41D` | `walk_step` | player.walkHalf |  |
| `$A49C` | `walk_next_phase` |  |  |
| `$A49E` | `walk_period` |  |  |
| `$A4A0` | `run_period` |  |  |
| `$A4A2` | `crawl_period` |  |  |
| `$A4A4` | `walk_sprite` |  |  |
| `$A4A6` | `crawl_sprite` |  |  |
| `$A4A8` | `climb_step` | player.climb |  |
| `$A50F` | `climb_frames` |  |  |
| `$A511` | `check_blocked_tile` | player.afterMove (bramble) |  |
| `$A53D` | `check_wall_hit` | player.afterMove / knockBack | wall in the body or head cell: revert and request a knock-down |
| `$A575` | `clear_move_states` | player.cancelMotion |  |
| `$A587` | `is_wall_tile` | world.role === 'wall' | returns Z=1 for the wall tiles $07/$08/$52 |
| `$A594` | `request_door` | player.fireHeld: state.stop {reason: 'door'} |  |
## Tool menu, sound effects, REST, TAKE, DROP

| address | label | port | note |
|---|---|---|---|
| `$A600` | `jt_room_is_outdoor` |  |  |
| `$A603` | `jt_return_home` |  |  |
| `$A606` | `jt_drowned` |  |  |
| `$A609` | `jt_verb_renew` |  |  |
| `$A60C` | `drowned_home` | game.resolveStop 'drown' |  |
| `$A64C` | `verb_renew` | verbs.renew |  |
| `$A67D` | `print_time_has_passed` | clock.loseDay |  |
| `$A6FB` | `return_to_nid` | clock.sendTo |  |
| `$A780` | `item_name_ofs` |  |  |
| `$A790` | `object_class_of` | state.objects[].class | object index in A -> class in Y; index $FF falls off the table |
| `$A7A0` | `object_class_ranges` |  |  |
| `$A7B2` | `verb_done` | game.endVerb |  |
| `$A800` | `jt_tool_menu` |  |  |
| `$A803` | `jt_set_panel_color` |  |  |
| `$A806` | `jt_sfx` |  |  |
| `$A81B` | `tool_menu` | verbs.runMenu |  |
| `$A898` | `tool_menu_dispatch` | verbs.runMenu | dispatch on $0A50 (col 0-4) / $0A51 (row 0-3); see docs/verbs-and-inventory.md |
| `$A933` | `set_panel_color` | state.textColor | A = colour for $DB48-$DBE7, the 4-line text panel |
| `$A93C` | `tool_menu_draw` | verbs.drawMenu |  |
| `$A94D` | `tool_menu_text` |  |  |
| `$A9ED` | `tool_menu_cell` |  |  |
| `$A9FF` | `tool_menu_hilite` |  |  |
| `$AA0F` | `tool_menu_unhilite` |  |  |
| `$AA1F` | `tool_menu_row_ofs` |  |  |
| `$AA23` | `tool_menu_col_ofs` |  |  |
| `$AA28` | `tool_menu_col_len` |  |  |
| `$AA2D` | `cycle_click` |  |  |
| `$AA40` | `sfx_play` | audio.Speaker.sfx | sfx_play: X = effect 0-13; returns immediately while music plays |
| `$AA73` | `sfx_ad` | music.json sfx |  |
| `$AA81` | `sfx_freq_lo` | music.json sfx |  |
| `$AA8F` | `sfx_freq_hi` | music.json sfx |  |
| `$AA9D` | `sfx_ctrl` | music.json sfx |  |
| `$AAAB` | `rest_steal_tokens` | verbs.rest |  |
| `$AAC3` | `rest_steal_shubas` | verbs.rest |  |
| `$AADB` | `rest_wake_room_1c` | verbs.rest |  |
| `$AB45` | `rest_wake_room_3b` | verbs.rest |  |
| `$AC00` | `jt_verb_rest` |  |  |
| `$AC03` | `jt_verb_take` |  |  |
| `$AC06` | `jt_verb_drop` |  |  |
| `$AC09` | `jt_object_class` |  |  |
| `$AC0C` | `jt_subtract_weight` |  |  |
| `$AC0F` | `jt_print_item_name` |  |  |
| `$AC12` | `jt_verb_done` |  |  |
| `$AC15` | `verb_rest` | verbs.rest |  |
| `$ACF7` | `rest_bell_ring` | verbs.rest (chime) | spirit bell: sfx 13/0 three times, then sfx 1 |
| `$AD13` | `rest_delay_or_wake` | verbs.restDelay |  |
| `$AD52` | `verb_take` | verbs.take |  |
| `$AE32` | `item_weight` | inventory.weightOf |  |
| `$AE41` | `verb_drop` | verbs.drop |  |
| `$AFC9` | `subtract_weight` | inventory.weightCarried | Y = class; $0A7A -= item_weight[Y] |
| `$AFD4` | `print_item_name` | items.json names | 16-char item name at $AFF7 + 16*class, via the $A780 offsets |
| `$AFF7` | `item_names` | items.json names |  |
## STATUS, clock, EAT, EXAMINE

| address | label | port | note |
|---|---|---|---|
| `$B100` | `jt_verb_status` |  |  |
| `$B106` | `jt_clock_tick` |  |  |
| `$B109` | `jt_advance_time` |  |  |
| `$B10C` | `jt_status_draw` |  |  |
| `$B10F` | `verb_status` | verbs.status |  |
| `$B122` | `draw_status` |  |  |
| `$B125` | `status_draw` | verbs.paintStatus |  |
| `$B1CB` | `char_name_ends` |  |  |
| `$B1D0` | `char_names` | characters.json |  |
| `$B1E9` | `time_of_day_names` | clock.timeOfDay |  |
| `$B261` | `status_num_ofs` |  |  |
| `$B267` | `time_of_day_ends` |  |  |
| `$B26F` | `clock_tick` | clock.clockTick | per-frame clock; frozen while $C8 is set |
| `$B287` | `advance_time` | clock.advanceHour | one time slot: $0A61, day wrap, food/rest down, +5 spirit energy |
| `$B320` | `creature_hit_effect` | game.ambushed / clock.kidnap |  |
| `$B400` | `jt_verb_eat` |  |  |
| `$B403` | `jt_verb_examine` |  |  |
| `$B406` | `jt_find_object_at` |  |  |
| `$B409` | `jt_find_object_under` |  |  |
| `$B40C` | `verb_eat` | verbs.eat |  |
| `$B5F0` | `find_object_under_player` | inventory.objectUnder | object under the player, for TAKE and EXAMINE; C set = none |
| `$B61D` | `find_object_at` | inventory.onFloor | scan all 256 objects for one at ($84,$85) in this room, on the ground |
| `$B653` | `verb_examine` | verbs.examine |  |
## Object tool tables

| address | label | port | note |
|---|---|---|---|
| `$C400` | `tooltab_room_lo` |  |  |
| `$C500` | `tooltab_col` |  |  |
| `$C600` | `tooltab_flags` |  |  |
