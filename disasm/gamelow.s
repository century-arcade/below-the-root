; gamelow  $3400-$55FF

        .org $3400

jt_main_menu:    ; <- 44A9 898C 8F14 93C9 A92D
        jmp main_menu_entry   ; 3400* 4C 06 34
gamelow_entry:
        jmp protection_check  ; 3403* 4C 99 37
; $D8: 0 = cold start (run attract), >0 = show menu, <0 = second attract screen
main_menu_entry:    ; <- 3400
        lda #$00              ; 3406* A9 00
        sta music_on          ; 3408* 8D 95 0A
        lda attract_state     ; 340B* A5 D8
        bmi menu_setup        ; 340D* 30 11
        bne L341C             ; 340F* D0 0B
        lda #$0D              ; 3411* A9 0D
        sta $02               ; 3413* 85 02
        lda #$01              ; 3415* A9 01
        sta attract_state     ; 3417* 85 D8
        jmp L9500             ; 3419* 4C 00 95
L341C:    ; <- 340F
        lda #$FF              ; 341C* A9 FF
        sta attract_state     ; 341E* 85 D8
menu_setup:    ; <- 340D
        lda #$00              ; 3420* A9 00
        sta $02               ; 3422* 85 02
        sta demo_flag         ; 3424* 8D 92 0A
        jsr L9506             ; 3427* 20 06 95
        lda #$01              ; 342A* A9 01
        jsr jt_music          ; 342C* 20 03 A8
        lda #$04              ; 342F* A9 04
        sta D0A4B             ; 3431* 8D 4B 0A
; stash the in-game room in $D3/$D4, then show the menu over attract room 157
        lda room_lo           ; 3434* A5 86
        sta saved_room_lo     ; 3436* 85 D3
        lda room_hi           ; 3438* A5 87
        sta saved_room_hi     ; 343A* 85 D4
        lda #$9D              ; 343C* A9 9D
        sta room_lo           ; 343E* 85 86
        lda #$00              ; 3440* A9 00
        sta room_hi           ; 3442* 85 87
        jsr L8803             ; 3444* 20 03 88
main_menu:    ; <- 36BB 38B5 38BF 39C3 3A16
        jsr draw_main_menu    ; 3447* 20 38 3A
        jsr highlight_menu_item; 344A* 20 89 3A
        jsr jt_wait_input     ; 344D* 20 27 80
menu_input_loop:    ; <- 3457 345D 3468 347C 370A
        jsr jt_get_input      ; 3450* 20 0F 80
        bne menu_fire         ; 3453* D0 2A
        lda $99               ; 3455* A5 99
        beq menu_input_loop   ; 3457* F0 F7
        bpl L3464             ; 3459  10 09
        lda menu_item         ; 345B  A5 D6
        beq menu_input_loop   ; 345D  F0 F1
        dec menu_item         ; 345F  C6 D6
        jmp L346C             ; 3461  4C 6C 34
L3464:    ; <- 3459
        lda menu_item         ; 3464  A5 D6
        cmp #$03              ; 3466  C9 03
        beq menu_input_loop   ; 3468  F0 E6
        inc menu_item         ; 346A  E6 D6
L346C:    ; <- 3461
        jsr draw_main_menu    ; 346C  20 38 3A
        jsr highlight_menu_item; 346F  20 89 3A
        ldx #$00              ; 3472  A2 00
        jsr jt_sfx            ; 3474  20 06 A8
        ldx #$50              ; 3477  A2 50
        jsr jt_delay          ; 3479  20 12 80
        jmp menu_input_loop   ; 347C  4C 50 34
menu_fire:    ; <- 3453
        lda menu_item         ; 347F* A5 D6
        bne L3486             ; 3481* D0 03
        jmp menu_start_game   ; 3483* 4C 97 34
L3486:    ; <- 3481
        cmp #$01              ; 3486  C9 01
        bne L348D             ; 3488  D0 03
        jmp menu_continue     ; 348A  4C 06 37
L348D:    ; <- 3488
        cmp #$02              ; 348D  C9 02
        bne L3494             ; 348F  D0 03
        jmp menu_disk_storage ; 3491  4C 42 38
L3494:    ; <- 348F
        jmp menu_sample_quest ; 3494  4C 2D 3A
menu_start_game:    ; <- 3483
        lda character         ; 3497* A5 D5
        sta charsel_saved     ; 3499* 85 D9
        lda loaded_player     ; 349B* AD 60 0A
        sta character         ; 349E* 85 D5
        jsr L9506             ; 34A0* 20 06 95
charsel_draw:    ; <- 36AB
        jsr print_inline      ; 34A3* 20 09 80
        .byte $4F,$C3,$43,$48,$4F,$4F,$53,$45,$20,$59,$4F,$55,$52,$20,$50,$4C; 34A6  O.CHOOSE YOUR PL
        .byte $41,$59,$45,$52,$3A,$FF                 ; 34B6  AYER:.
        lda character         ; 34BC* A5 D5
        bne L3514             ; 34BE* D0 54
        jsr print_inline      ; 34C0* 20 09 80
        .byte $64,$C3,$4E,$45,$52,$49,$43,$FF         ; 34C3  d.NERIC.
        jsr print_inline      ; 34CB* 20 09 80
        .byte $99,$C3,$41,$20,$4B,$49,$4E,$44,$41,$52,$2D,$42,$4F,$52,$4E,$20; 34CE  ..A KINDAR-BORN 
        .byte $59,$4F,$55,$4E,$47,$20,$4D,$41,$4E,$FF ; 34DE  YOUNG MAN.
        jsr print_inline      ; 34E8* 20 09 80
        .byte $C1,$C3,$53,$54,$52,$4F,$4E,$47,$2D,$2D,$49,$4D,$50,$55,$4C,$53; 34EB  ..STRONG--IMPULS
        .byte $49,$56,$45,$2D,$2D,$4D,$4F,$44,$45,$52,$41,$54,$45,$20,$53,$50; 34FB  IVE--MODERATE SP
        .byte $49,$52,$49,$54,$20,$FF                 ; 350B  IRIT .
        jmp charsel_input     ; 3511* 4C 8A 36
L3514:    ; <- 34BE
        cmp #$01              ; 3514  C9 01
        bne L356F             ; 3516  D0 57
        jsr print_inline      ; 3518  20 09 80
        .byte $64,$C3,$47,$45,$4E,$41,$41,$FF         ; 351B  d.GENAA.
        jsr print_inline      ; 3523  20 09 80
        .byte $99,$C3,$41,$20,$4B,$49,$4E,$44,$41,$52,$2D,$42,$4F,$52,$4E,$20; 3526  ..A KINDAR-BORN 
        .byte $59,$4F,$55,$4E,$47,$20,$57,$4F,$4D,$41,$4E,$FF; 3536  YOUNG WOMAN.
        jsr print_inline      ; 3542  20 09 80
        .byte $C1,$C3,$53,$54,$52,$4F,$4E,$47,$2D,$2D,$43,$48,$41,$52,$49,$53; 3545  ..STRONG--CHARIS
        .byte $4D,$41,$54,$49,$43,$2D,$2D,$4E,$4F,$20,$53,$50,$49,$52,$49,$54; 3555  MATIC--NO SPIRIT
        .byte $20,$53,$4B,$49,$4C,$4C,$FF             ; 3565   SKILL.
        jmp charsel_input     ; 356C  4C 8A 36
L356F:    ; <- 3516
        cmp #$02              ; 356F  C9 02
        bne L35CA             ; 3571  D0 57
        jsr print_inline      ; 3573  20 09 80
        .byte $64,$C3,$48,$45,$52,$44,$20,$FF         ; 3576  d.HERD .
        jsr print_inline      ; 357E  20 09 80
        .byte $99,$C3,$41,$20,$43,$41,$56,$45,$52,$4E,$2D,$42,$4F,$52,$4E,$20; 3581  ..A CAVERN-BORN 
        .byte $45,$52,$44,$4C,$49,$4E,$47,$20,$20,$20,$20,$FF; 3591  ERDLING    .
        jsr print_inline      ; 359D  20 09 80
        .byte $C1,$C3,$53,$54,$52,$4F,$4E,$47,$2D,$2D,$52,$41,$54,$49,$4F,$4E; 35A0  ..STRONG--RATION
        .byte $41,$4C,$2D,$2D,$4D,$4F,$44,$45,$52,$41,$54,$45,$20,$53,$50,$49; 35B0  AL--MODERATE SPI
        .byte $52,$49,$54,$20,$20,$20,$FF             ; 35C0  RIT   .
        jmp charsel_input     ; 35C7  4C 8A 36
L35CA:    ; <- 3571
        cmp #$03              ; 35CA  C9 03
        bne L361E             ; 35CC  D0 50
        jsr print_inline      ; 35CE  20 09 80
        .byte $64,$C3,$50,$4F,$4D,$4D,$41,$FF         ; 35D1  d.POMMA.
        jsr print_inline      ; 35D9  20 09 80
        .byte $99,$C3,$41,$20,$4B,$49,$4E,$44,$41,$52,$20,$47,$49,$52,$4C,$2D; 35DC  ..A KINDAR GIRL-
        .byte $43,$48,$49,$4C,$44,$20,$20,$FF         ; 35EC  CHILD  .
        jsr print_inline      ; 35F4  20 09 80
        .byte $C1,$C3,$44,$45,$4C,$49,$43,$41,$54,$45,$2D,$2D,$47,$52,$45,$41; 35F7  ..DELICATE--GREA
        .byte $54,$4C,$59,$20,$53,$50,$49,$52,$49,$54,$20,$47,$49,$46,$54,$45; 3607  TLY SPIRIT GIFTE
        .byte $44,$20,$20,$FF                         ; 3617  D  .
        jmp charsel_input     ; 361B  4C 8A 36
L361E:    ; <- 35CC
        cmp #$04              ; 361E  C9 04
        bne L3673             ; 3620  D0 51
        jsr print_inline      ; 3622  20 09 80
        .byte $64,$C3,$43,$48,$41,$52,$4E,$FF         ; 3625  d.CHARN.
        jsr print_inline      ; 362D  20 09 80
        .byte $99,$C3,$41,$4E,$20,$45,$52,$44,$4C,$49,$4E,$47,$20,$42,$4F,$59; 3630  ..AN ERDLING BOY
        .byte $2D,$43,$48,$49,$4C,$44,$FF             ; 3640  -CHILD.
        jsr print_inline      ; 3647  20 09 80
        .byte $C1,$C3,$53,$54,$55,$52,$44,$59,$2D,$2D,$41,$4C,$45,$52,$54,$2D; 364A  ..STURDY--ALERT-
        .byte $2D,$4D,$4F,$44,$45,$52,$41,$54,$45,$20,$53,$50,$49,$52,$49,$54; 365A  -MODERATE SPIRIT
        .byte $20,$47,$49,$46,$54,$FF                 ; 366A   GIFT.
        jmp charsel_input     ; 3670  4C 8A 36
L3673:    ; <- 3620
        jsr L9506             ; 3673  20 06 95
        jsr print_inline      ; 3676  20 09 80
        .byte $54,$C3,$52,$45,$54,$55,$52,$4E,$20,$54,$4F,$20,$4D,$45,$4E,$55; 3679  T.RETURN TO MENU
        .byte $FF                                     ; 3689  .
charsel_input:    ; <- 3511 356C 35C7 361B 3670
        ldx #$01              ; 368A* A2 01
        jsr jt_sfx            ; 368C* 20 06 A8
        ldx #$A0              ; 368F* A2 A0
        jsr jt_delay          ; 3691* 20 12 80
        jsr jt_wait_input     ; 3694* 20 27 80
L3697:    ; <- 369E
        jsr jt_get_input      ; 3697* 20 0F 80
        bne charsel_fire      ; 369A* D0 12
        lda $99               ; 369C* A5 99
        bpl L3697             ; 369E* 10 F7
        ldx character         ; 36A0  A6 D5
        inx                   ; 36A2  E8
        cpx #$06              ; 36A3  E0 06
        bne L36A9             ; 36A5  D0 02
        ldx #$00              ; 36A7  A2 00
L36A9:    ; <- 36A5
        stx character         ; 36A9  86 D5
        jmp charsel_draw      ; 36AB  4C A3 34
charsel_fire:    ; <- 369A
        jsr L9506             ; 36AE* 20 06 95
        lda character         ; 36B1* A5 D5
        cmp #$05              ; 36B3* C9 05
        bne start_quest       ; 36B5* D0 07
        lda charsel_saved     ; 36B7  A5 D9
        sta character         ; 36B9  85 D5
        jmp main_menu         ; 36BB  4C 47 34
start_quest:    ; <- 36B5
        cmp loaded_player     ; 36BE* CD 60 0A
        beq L36C6             ; 36C1* F0 03
        jsr load_player_file  ; 36C3  20 A1 3A
L36C6:    ; <- 36C1
        jsr L950F             ; 36C6* 20 0F 95
        lda #$23              ; 36C9* A9 23
        ldx #$01              ; 36CB* A2 01
        jsr jt_memclr_pages   ; 36CD* 20 33 80
        jsr L9C15             ; 36D0* 20 15 9C
        lda #$FF              ; 36D3* A9 FF
        sta $C5               ; 36D5* 85 C5
        lda nid_room_lo       ; 36D7* AD 6D 0A
        sta room_lo           ; 36DA* 85 86
        lda nid_room_hi       ; 36DC* AD 6E 0A
        sta room_hi           ; 36DF* 85 87
        lda #$01              ; 36E1* A9 01
        sta D0A0E             ; 36E3* 8D 0E 0A
        sta quest_active      ; 36E6* 85 D7
        lda nid_col           ; 36E8* AD 6F 0A
        sta D0A17             ; 36EB* 8D 17 0A
        lda nid_row           ; 36EE* AD 70 0A
        sta D0A1F             ; 36F1* 8D 1F 0A
        jsr L8803             ; 36F4* 20 03 88
        lda #$00              ; 36F7* A9 00
        sta $D0               ; 36F9* 85 D0
        sta $C8               ; 36FB* 85 C8
        sta $CA               ; 36FD* 85 CA
        sta $CB               ; 36FF* 85 CB
        sta $CE               ; 3701* 85 CE
        jmp jt_run_new_game   ; 3703* 4C 15 95
menu_continue:    ; <- 348A
        lda quest_active      ; 3706  A5 D7
        bne L370D             ; 3708  D0 03
        jmp menu_input_loop   ; 370A  4C 50 34
L370D:    ; <- 3708
        jsr L9506             ; 370D  20 06 95
        lda character         ; 3710  A5 D5
        cmp loaded_player     ; 3712  CD 60 0A
        beq L371D             ; 3715  F0 06
        sta loaded_player     ; 3717  8D 60 0A
        jsr load_player_file  ; 371A  20 A1 3A
L371D:    ; <- 3715
        lda #$01              ; 371D  A9 01
        sta $D027             ; 371F  8D 27 D0
        sta $D028             ; 3722  8D 28 D0
        jsr L9C0F             ; 3725  20 0F 9C
        lda saved_room_lo     ; 3728  A5 D3
        sta room_lo           ; 372A  85 86
        lda saved_room_hi     ; 372C  A5 D4
        sta room_hi           ; 372E  85 87
        jsr L9512             ; 3730  20 12 95
        jmp jt_resume_game    ; 3733  4C 18 95
disk_open15:    ; <- 374A 376B 3799
        jsr disk_close15      ; 3736* 20 5C 37
        lda #$00              ; 3739* A9 00
        jsr SETNAM            ; 373B* 20 BD FF
        lda #$0F              ; 373E* A9 0F
        ldx #$08              ; 3740* A2 08
        tay                   ; 3742* A8
        jsr SETLFS            ; 3743* 20 BA FF
        jsr OPEN              ; 3746* 20 C0 FF
        rts                   ; 3749* 60
disk_init_drive:    ; <- 3768 378B
        jsr disk_open15       ; 374A  20 36 37
        ldx #$0F              ; 374D  A2 0F
        jsr CHKOUT            ; 374F  20 C9 FF
        lda #$49              ; 3752  A9 49
        jsr CHROUT            ; 3754  20 D2 FF
        lda #$30              ; 3757  A9 30
        jsr CHROUT            ; 3759  20 D2 FF
disk_close15:    ; <- 3736 37C6
        jsr CLRCHN            ; 375C* 20 CC FF
        lda #$0F              ; 375F* A9 0F
        jsr CLOSE             ; 3761* 20 C3 FF
        jsr CLALL             ; 3764* 20 E7 FF
        rts                   ; 3767* 60
scratch_quest_file:    ; <- 398F
        jsr disk_init_drive   ; 3768  20 4A 37
        jsr disk_open15       ; 376B  20 36 37
        ldx #$0F              ; 376E  A2 0F
        jsr CHKOUT            ; 3770  20 C9 FF
        ldy #$00              ; 3773  A0 00
L3775:    ; <- 377E
        lda str_scratch_quest,y; 3775  B9 8F 37
        beq L3780             ; 3778  F0 06
        jsr CHROUT            ; 377A  20 D2 FF
        iny                   ; 377D  C8
        bne L3775             ; 377E  D0 F5
L3780:    ; <- 3778
        jsr CLRCHN            ; 3780  20 CC FF
        lda #$0F              ; 3783  A9 0F
        jsr CLOSE             ; 3785  20 C3 FF
        jsr CLALL             ; 3788  20 E7 FF
        jsr disk_init_drive   ; 378B  20 4A 37
        rts                   ; 378E  60
str_scratch_quest:    ; <- 3775
        .byte $53,$30,$3A,$51,$55,$45,$53,$54         ; 378F  S0:QUEST
D3797:    ; <- 395B
        .byte $2A,$00                                 ; 3797  *.
protection_check:    ; <- 3403
        jsr disk_open15       ; 3799* 20 36 37
        lda #$05              ; 379C* A9 05
        tay                   ; 379E* A8
        ldx #$08              ; 379F* A2 08
        jsr SETLFS            ; 37A1* 20 BA FF
        lda #$01              ; 37A4* A9 01
        ldx #$32              ; 37A6* A2 32
        ldy #$38              ; 37A8* A0 38
        jsr SETNAM            ; 37AA* 20 BD FF
        jsr OPEN              ; 37AD* 20 C0 FF
        jsr protection_scan_track; 37B0* 20 C9 37
        inc D383C             ; 37B3* EE 3C 38
        lda #$37              ; 37B6* A9 37
        sta D3841             ; 37B8* 8D 41 38
        jsr protection_scan_track; 37BB* 20 C9 37
        lda #$05              ; 37BE* A9 05
        jsr CLOSE             ; 37C0* 20 C3 FF
        jsr prot_record       ; 37C3* 20 5D 3B
        jmp disk_close15      ; 37C6* 4C 5C 37
protection_scan_track:    ; <- 37B0 37BB
        ldx #$05              ; 37C9* A2 05
        jsr CHKIN             ; 37CB* 20 C6 FF
        ldy #$01              ; 37CE* A0 01
L37D0:    ; <- 381A
        tya                   ; 37D0* 98
        sec                   ; 37D1* 38
        ldx #$2F              ; 37D2* A2 2F
L37D4:    ; <- 37D7
        inx                   ; 37D4* E8
        sbc #$0A              ; 37D5* E9 0A
        bcs L37D4             ; 37D7* B0 FB
        adc #$3A              ; 37D9* 69 3A
        stx D383E             ; 37DB* 8E 3E 38
        sta D383F             ; 37DE* 8D 3F 38
        ldx #$0F              ; 37E1* A2 0F
        jsr CHKOUT            ; 37E3* 20 C9 FF
        ldx #$00              ; 37E6* A2 00
L37E8:    ; <- 37F1
        lda prot_cmd_str,x    ; 37E8* BD 33 38
        jsr CHROUT            ; 37EB* 20 D2 FF
        inx                   ; 37EE* E8
        cpx #$0D              ; 37EF* E0 0D
        bne L37E8             ; 37F1* D0 F5
        jsr CLRCHN            ; 37F3* 20 CC FF
        lda #$08              ; 37F6* A9 08
        sta $BA               ; 37F8* 85 BA
        jsr LISTEN            ; 37FA* 20 B4 FF
        lda #$6F              ; 37FD* A9 6F
        sta $B9               ; 37FF* 85 B9
        jsr SECOND            ; 3801* 20 96 FF
        jsr ACPTR             ; 3804* 20 A5 FF
        cmp D3840             ; 3807* CD 40 38
        bne L3814             ; 380A* D0 08
        jsr ACPTR             ; 380C* 20 A5 FF
        cmp D3841             ; 380F* CD 41 38
        beq L381F             ; 3812* F0 0B
L3814:    ; <- 380A
        jsr L381F             ; 3814  20 1F 38
        iny                   ; 3817  C8
        cpy #$11              ; 3818  C0 11
        bne L37D0             ; 381A  D0 B4
        pla                   ; 381C  68
        pla                   ; 381D  68
        rts                   ; 381E  60
L381F:    ; <- 3812 3814
        lda #$08              ; 381F* A9 08
        jsr LISTEN            ; 3821* 20 B4 FF
        jsr SECOND            ; 3824* 20 96 FF
L3827:    ; <- 382C
        jsr ACPTR             ; 3827* 20 A5 FF
        bit $90               ; 382A* 24 90
        bvc L3827             ; 382C* 50 F9
        jsr UNTALK            ; 382E* 20 AB FF
        rts                   ; 3831* 60
        .byte $23                                     ; 3832  #
prot_cmd_str:    ; <- 37E8
        .byte $55,$31,$3A,$20,$35,$20,$30,$20,$30     ; 3833  U1: 5 0 0
D383C:    ; <- 37B3
        .byte $33,$20                                 ; 383C  3 
D383E:    ; <- 37DB
        .byte $30                                     ; 383E  0
D383F:    ; <- 37DE
        .byte $31                                     ; 383F  1
D3840:    ; <- 3807
        .byte $32                                     ; 3840  2
D3841:    ; <- 37B8 380F
        .byte $37                                     ; 3841  7
menu_disk_storage:    ; <- 3491
        jsr L9506             ; 3842  20 06 95
storage_draw:    ; <- 38A7
        jsr print_inline      ; 3845  20 09 80
        .byte $49,$C3,$20,$53,$41,$56,$45,$20,$47,$41,$4D,$45,$20,$20,$4C,$4F; 3848  I. SAVE GAME  LO
        .byte $41,$44,$20,$47,$41,$4D,$45,$20,$20,$52,$45,$54,$55,$52,$4E,$20; 3858  AD GAME  RETURN 
        .byte $54,$4F,$20,$4D,$45,$4E,$55,$20,$FF     ; 3868  TO MENU .
        ldy storage_item      ; 3871  A4 DA
        ldx storage_item_col,y; 3873  BE 19 3A
        lda storage_item_len,y; 3876  B9 1C 3A
        tay                   ; 3879  A8
L387A:    ; <- 3884
        lda DC348,x           ; 387A  BD 48 C3
        ora #$80              ; 387D  09 80
        sta DC348,x           ; 387F  9D 48 C3
        inx                   ; 3882  E8
        dey                   ; 3883  88
        bne L387A             ; 3884  D0 F4
        ldx #$01              ; 3886  A2 01
        jsr jt_sfx            ; 3888  20 06 A8
        ldx #$A0              ; 388B  A2 A0
        jsr jt_delay          ; 388D  20 12 80
        jsr jt_wait_input     ; 3890  20 27 80
storage_input:    ; <- 389A 389F 38A3
        jsr jt_get_input      ; 3893  20 0F 80
        bne L38AA             ; 3896  D0 12
        lda $98               ; 3898  A5 98
        beq storage_input     ; 389A  F0 F7
        clc                   ; 389C  18
        adc storage_item      ; 389D  65 DA
        bmi storage_input     ; 389F  30 F2
        cmp #$03              ; 38A1  C9 03
        beq storage_input     ; 38A3  F0 EE
        sta storage_item      ; 38A5  85 DA
        jmp storage_draw      ; 38A7  4C 45 38
L38AA:    ; <- 3896
        lda storage_item      ; 38AA  A5 DA
        bne L38B8             ; 38AC  D0 0A
        lda quest_active      ; 38AE  A5 D7
        bne slot_draw         ; 38B0  D0 10
        jsr L9506             ; 38B2  20 06 95
        jmp main_menu         ; 38B5  4C 47 34
L38B8:    ; <- 38AC
        cmp #$01              ; 38B8  C9 01
        beq slot_draw         ; 38BA  F0 06
        jsr L9506             ; 38BC  20 06 95
        jmp main_menu         ; 38BF  4C 47 34
slot_draw:    ; <- 38B0 38BA 3912
        jsr print_inline      ; 38C2  20 09 80
        .byte $A1,$C3,$51,$55,$45,$53,$54,$20,$20,$20,$31,$20,$20,$32,$20,$20; 38C5  ..QUEST   1  2  
        .byte $33,$20,$20,$34,$20,$20,$35,$20,$FF     ; 38D5  3  4  5 .
        ldy quest_slot        ; 38DE  A4 DB
        ldx slot_item_col,y   ; 38E0  BE 1F 3A
        ldy #$03              ; 38E3  A0 03
L38E5:    ; <- 38EF
        lda DC348,x           ; 38E5  BD 48 C3
        ora #$80              ; 38E8  09 80
        sta DC348,x           ; 38EA  9D 48 C3
        inx                   ; 38ED  E8
        dey                   ; 38EE  88
        bne L38E5             ; 38EF  D0 F4
        ldx #$00              ; 38F1  A2 00
        jsr jt_sfx            ; 38F3  20 06 A8
        ldx #$80              ; 38F6  A2 80
        jsr jt_delay          ; 38F8  20 12 80
        jsr jt_wait_input     ; 38FB  20 27 80
slot_input:    ; <- 3905 390A 390E
        jsr jt_get_input      ; 38FE  20 0F 80
        bne storage_go        ; 3901  D0 12
        lda $98               ; 3903  A5 98
        beq slot_input        ; 3905  F0 F7
        clc                   ; 3907  18
        adc quest_slot        ; 3908  65 DB
        bmi slot_input        ; 390A  30 F2
        cmp #$05              ; 390C  C9 05
        beq slot_input        ; 390E  F0 EE
        sta quest_slot        ; 3910  85 DB
        jmp slot_draw         ; 3912  4C C2 38
storage_go:    ; <- 3901
        jsr L9506             ; 3915  20 06 95
        jsr print_inline      ; 3918  20 09 80
        .byte $49,$C3,$49,$4E,$53,$45,$52,$54,$20,$53,$54,$4F,$52,$41,$47,$45; 391B  I.INSERT STORAGE
        .byte $20,$44,$49,$53,$4B,$20,$2D,$20,$50,$52,$45,$53,$53,$20,$54,$52; 392B   DISK - PRESS TR
        .byte $49,$47,$47,$45,$52,$FF                 ; 393B  IGGER.
        ldx #$01              ; 3941  A2 01
        jsr jt_sfx            ; 3943  20 06 A8
        ldx #$A0              ; 3946  A2 A0
        jsr jt_delay          ; 3948  20 12 80
        jsr jt_wait_input     ; 394B  20 27 80
L394E:    ; <- 3951
        jsr jt_get_input      ; 394E  20 0F 80
        beq L394E             ; 3951  F0 FB
        lda quest_slot        ; 3953  A5 DB
        clc                   ; 3955  18
        adc #$30              ; 3956  69 30
        sta save_name_digit   ; 3958  8D 2B 3A
        sta D3797             ; 395B  8D 97 37
        jsr L9506             ; 395E  20 06 95
        lda storage_item      ; 3961  A5 DA
        beq save_game         ; 3963  F0 03
        jmp load_game         ; 3965  4C C6 39
; state vector $2000-$257F = $0D00-$0FFF + live $2300-$23FF + $0A00-$0AFF + zp $80-$FF
save_game:    ; <- 3963
        lda saved_room_lo     ; 3968  A5 D3
        sta room_lo           ; 396A  85 86
        lda saved_room_hi     ; 396C  A5 D4
        sta room_hi           ; 396E  85 87
        lda #$0D              ; 3970  A9 0D
        ldy #$20              ; 3972  A0 20
        ldx #$03              ; 3974  A2 03
        jsr jt_memcpy_pages   ; 3976  20 30 80
        lda #$0A              ; 3979  A9 0A
        ldy #$24              ; 397B  A0 24
        ldx #$01              ; 397D  A2 01
        jsr jt_memcpy_pages   ; 397F  20 30 80
        ldx #$7F              ; 3982  A2 7F
L3984:    ; <- 398A
        lda $80,x             ; 3984  B5 80
        sta save_zp,x         ; 3986  9D 00 25
        dex                   ; 3989  CA
        bpl L3984             ; 398A  10 F8
        jsr disk_io_prologue  ; 398C  20 18 3B
        jsr scratch_quest_file; 398F  20 68 37
        lda #$05              ; 3992  A9 05
        ldx #$08              ; 3994  A2 08
        ldy #$FF              ; 3996  A0 FF
        jsr SETLFS            ; 3998  20 BA FF
        lda #$08              ; 399B  A9 08
        ldx #$24              ; 399D  A2 24
        ldy #$3A              ; 399F  A0 3A
        jsr SETNAM            ; 39A1  20 BD FF
        lda #$00              ; 39A4  A9 00
        sta $FD               ; 39A6  85 FD
        lda #$20              ; 39A8  A9 20
        sta $FE               ; 39AA  85 FE
        ldx #$80              ; 39AC  A2 80
        ldy #$25              ; 39AE  A0 25
        lda #$FD              ; 39B0  A9 FD
        jsr DFFD8             ; 39B2  20 D8 FF
        jsr jt_zp_swap        ; 39B5  20 06 80
        jsr L8809             ; 39B8  20 09 88
        lda #$04              ; 39BB  A9 04
        sta D0A4B             ; 39BD  8D 4B 0A
        jsr prompt_side2      ; 39C0  20 2E 3B
        jmp main_menu         ; 39C3  4C 47 34
load_game:    ; <- 3965
        lda loaded_player     ; 39C6  AD 60 0A
        sta D0802             ; 39C9  8D 02 08
        jsr disk_io_prologue  ; 39CC  20 18 3B
        lda #$05              ; 39CF  A9 05
        ldx #$08              ; 39D1  A2 08
        ldy #$FF              ; 39D3  A0 FF
        jsr SETLFS            ; 39D5  20 BA FF
        lda #$06              ; 39D8  A9 06
        ldx #$26              ; 39DA  A2 26
        ldy #$3A              ; 39DC  A0 3A
        jsr SETNAM            ; 39DE  20 BD FF
        lda #$00              ; 39E1  A9 00
        jsr LFFD5             ; 39E3  20 D5 FF
        jsr jt_zp_swap        ; 39E6  20 06 80
        jsr L8809             ; 39E9  20 09 88
        lda #$04              ; 39EC  A9 04
        sta D0A4B             ; 39EE  8D 4B 0A
        ldy #$0D              ; 39F1  A0 0D
        lda #$20              ; 39F3  A9 20
        ldx #$03              ; 39F5  A2 03
        jsr jt_memcpy_pages   ; 39F7  20 30 80
        ldy #$0A              ; 39FA  A0 0A
        lda #$24              ; 39FC  A9 24
        ldx #$01              ; 39FE  A2 01
        jsr jt_memcpy_pages   ; 3A00  20 30 80
        ldx #$7F              ; 3A03  A2 7F
L3A05:    ; <- 3A0B
        lda save_zp,x         ; 3A05  BD 00 25
        sta $80,x             ; 3A08  95 80
        dex                   ; 3A0A  CA
        bpl L3A05             ; 3A0B  10 F8
        lda D0802             ; 3A0D  AD 02 08
        sta loaded_player     ; 3A10  8D 60 0A
        jsr prompt_side2      ; 3A13  20 2E 3B
        jmp main_menu         ; 3A16  4C 47 34
storage_item_col:    ; <- 3873
        .byte $01,$0C,$17                             ; 3A19  ...
storage_item_len:    ; <- 3876
        .byte $0B,$0B,$10                             ; 3A1C  ...
slot_item_col:    ; <- 38E0
        .byte $60,$63,$66,$69,$6C                     ; 3A1F  `cfil
; SAVE writes '0:QUESTn'; LOAD opens the same name from $3A26 without the '0:'
str_save_name:
        .byte $30,$3A,$51,$55,$45,$53,$54             ; 3A24  0:QUEST
save_name_digit:    ; <- 3958
        .byte $2A,$00                                 ; 3A2B  *.
menu_sample_quest:    ; <- 3494
        lda #$0D              ; 3A2D  A9 0D
        sta $02               ; 3A2F  85 02
        lda #$00              ; 3A31  A9 00
        sta quest_active      ; 3A33  85 D7
        jmp L9500             ; 3A35  4C 00 95
draw_main_menu:    ; <- 3447 346C
        jsr print_inline      ; 3A38* 20 09 80
        .byte $55,$C3,$20,$20,$53,$54,$41,$52,$54,$20,$47,$41,$4D,$45,$20,$20; 3A3B  U.  START GAME  
        .byte $FF                                     ; 3A4B  .
        jsr print_inline      ; 3A4C* 20 09 80
        .byte $7D,$C3,$20,$20,$20,$43,$4F,$4E,$54,$49,$4E,$55,$45,$20,$20,$20; 3A4F  }.   CONTINUE   
        .byte $FF                                     ; 3A5F  .
        jsr print_inline      ; 3A60* 20 09 80
        .byte $A5,$C3,$20,$44,$49,$53,$4B,$20,$53,$54,$4F,$52,$41,$47,$45,$20; 3A63  .. DISK STORAGE 
        .byte $FF                                     ; 3A73  .
        jsr print_inline      ; 3A74* 20 09 80
        .byte $CD,$C3,$20,$53,$41,$4D,$50,$4C,$45,$20,$51,$55,$45,$53,$54,$20; 3A77  .. SAMPLE QUEST 
        .byte $FF                                     ; 3A87  .
        rts                   ; 3A88* 60
highlight_menu_item:    ; <- 344A 346F
        ldy menu_item         ; 3A89* A4 D6
        ldx menu_item_col,y   ; 3A8B* BE 9D 3A
        ldy #$0E              ; 3A8E* A0 0E
L3A90:    ; <- 3A9A
        lda DC348,x           ; 3A90* BD 48 C3
        ora #$80              ; 3A93* 09 80
        sta DC348,x           ; 3A95* 9D 48 C3
        inx                   ; 3A98* E8
        dey                   ; 3A99* 88
        bne L3A90             ; 3A9A* D0 F4
        rts                   ; 3A9C* 60
menu_item_col:    ; <- 3A8B
        .byte $0D,$35,$5D,$85                         ; 3A9D  .5].
load_player_file:    ; <- 36C3 371A
        jsr L9506             ; 3AA1  20 06 95
        jsr print_inline      ; 3AA4  20 09 80
        .byte $49,$C3,$49,$4E,$53,$45,$52,$54,$20,$53,$49,$44,$45,$20,$31,$20; 3AA7  I.INSERT SIDE 1 
        .byte $2D,$20,$50,$52,$45,$53,$53,$20,$54,$52,$49,$47,$47,$45,$52,$FF; 3AB7  - PRESS TRIGGER.
        ldx #$FF              ; 3AC7  A2 FF
        jsr jt_delay          ; 3AC9  20 12 80
        jsr jt_wait_input     ; 3ACC  20 27 80
        jsr jt_wait_input     ; 3ACF  20 27 80
L3AD2:    ; <- 3AD5
        jsr jt_get_input      ; 3AD2  20 0F 80
        beq L3AD2             ; 3AD5  F0 FB
        jsr L9506             ; 3AD7  20 06 95
        lda character         ; 3ADA  A5 D5
        clc                   ; 3ADC  18
        adc #$30              ; 3ADD  69 30
        sta player_name_digit ; 3ADF  8D 16 3B
        jsr disk_io_prologue  ; 3AE2  20 18 3B
        lda #$05              ; 3AE5  A9 05
        ldx #$08              ; 3AE7  A2 08
        ldy #$FF              ; 3AE9  A0 FF
        jsr SETLFS            ; 3AEB  20 BA FF
        lda #$07              ; 3AEE  A9 07
        ldx #$10              ; 3AF0  A2 10
        ldy #$3B              ; 3AF2  A0 3B
        jsr SETNAM            ; 3AF4  20 BD FF
        lda #$00              ; 3AF7  A9 00
        jsr LFFD5             ; 3AF9  20 D5 FF
        jsr jt_zp_swap        ; 3AFC  20 06 80
        lda character         ; 3AFF  A5 D5
        sta loaded_player     ; 3B01  8D 60 0A
        jsr L8809             ; 3B04  20 09 88
        lda #$04              ; 3B07  A9 04
        sta D0A4B             ; 3B09  8D 4B 0A
        jsr prompt_side2      ; 3B0C  20 2E 3B
        rts                   ; 3B0F  60
str_player_name:
        .byte $50,$4C,$41,$59,$45,$52                 ; 3B10  PLAYER
player_name_digit:    ; <- 3ADF
        .byte $2A,$00                                 ; 3B16  *.
disk_io_prologue:    ; <- 398C 39CC 3AE2
        lda $D01A             ; 3B18  AD 1A D0
        and #$FE              ; 3B1B  29 FE
        sta $D01A             ; 3B1D  8D 1A D0
        lda #$02              ; 3B20  A9 02
        sta VIC_MEM           ; 3B22  8D 18 D0
        jsr jt_zp_swap        ; 3B25  20 06 80
        lda #$00              ; 3B28  A9 00
        jsr DFF90             ; 3B2A  20 90 FF
        rts                   ; 3B2D  60
prompt_side2:    ; <- 39C0 3A13 3B0C
        jsr print_inline      ; 3B2E  20 09 80
        .byte $49,$C3,$49,$4E,$53,$45,$52,$54,$20,$53,$49,$44,$45,$20,$32,$20; 3B31  I.INSERT SIDE 2 
        .byte $2D,$20,$50,$52,$45,$53,$53,$20,$54,$52,$49,$47,$47,$45,$52,$FF; 3B41  - PRESS TRIGGER.
        jsr jt_wait_input     ; 3B51  20 27 80
L3B54:    ; <- 3B57
        jsr jt_get_input      ; 3B54  20 0F 80
        beq L3B54             ; 3B57  F0 FB
        jsr L9506             ; 3B59  20 06 95
        rts                   ; 3B5C  60
prot_record:    ; <- 37C3
        lda D9C1B             ; 3B5D* AD 1B 9C
        sta L9C12+1           ; 3B60* 8D 13 9C
        rts                   ; 3B63* 60
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3B64  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3B74  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3B84  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3B94  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3BA4  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3BB4  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3BC4  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3BD4  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3BE4  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 3BF4  ............
jt_print_message:
        .byte $4C,$15,$3C                             ; 3C00  L.<
jt_verb_speak:    ; <- A8AA
        jmp verb_speak        ; 3C03  4C 48 3C
jt_verb_pense:    ; <- A8B1
        jmp verb_pense        ; 3C06  4C 7B 40
jt_verb_buy:    ; <- A8C7
        jmp verb_buy          ; 3C09  4C 94 41
jt_verb_sell:    ; <- A8E4
        jmp verb_sell         ; 3C0C  4C 34 42
jt_verb_offer:    ; <- A8B4
        jmp verb_offer        ; 3C0F  4C CC 43
jt_play_random_tune:    ; <- 8E6A 928C 92F5
        jmp play_random_tune  ; 3C12  4C 38 3D
print_message:    ; <- 3CCE 3CD8 410F 4162
        stx $80               ; 3C15  86 80
        sty $81               ; 3C17  84 81
        sta $84               ; 3C19  85 84
        lda #$00              ; 3C1B  A9 00
        sta $82               ; 3C1D  85 82
        lda #$45              ; 3C1F  A9 45
        sta $83               ; 3C21  85 83
L3C23:    ; <- 3C3B
        ldy #$00              ; 3C23  A0 00
        dec $84               ; 3C25  C6 84
        beq L3C3E             ; 3C27  F0 15
L3C29:    ; <- 3C2E
        lda ($82),y           ; 3C29  B1 82
        bmi L3C30             ; 3C2B  30 03
        iny                   ; 3C2D  C8
        bne L3C29             ; 3C2E  D0 F9
L3C30:    ; <- 3C2B
        iny                   ; 3C30  C8
        tya                   ; 3C31  98
        clc                   ; 3C32  18
        adc $82               ; 3C33  65 82
        bcc L3C39             ; 3C35  90 02
        inc $83               ; 3C37  E6 83
L3C39:    ; <- 3C35
        sta $82               ; 3C39  85 82
        jmp L3C23             ; 3C3B  4C 23 3C
L3C3E:    ; <- 3C27 3C45
        lda ($82),y           ; 3C3E  B1 82
        bmi L3C47             ; 3C40  30 05
        sta ($80),y           ; 3C42  91 80
        iny                   ; 3C44  C8
        bne L3C3E             ; 3C45  D0 F7
L3C47:    ; <- 3C40
        rts                   ; 3C47  60
verb_speak:    ; <- 3C03
        jsr L9506             ; 3C48  20 06 95
        lda blk_creature      ; 3C4B  AD E0 09
        bne L3C69             ; 3C4E  D0 19
L3C50:    ; <- 3C6C
        jsr print_inline      ; 3C50  20 09 80
        .byte $49,$C3,$53,$50,$45,$41,$4B,$20,$57,$49,$54,$48,$20,$57,$48,$4F; 3C53  I.SPEAK WITH WHO
        .byte $4D,$3F,$FF                             ; 3C63  M?.
        jmp LAC12             ; 3C66  4C 12 AC
L3C69:    ; <- 3C4E
        jsr npc_adjacent      ; 3C69  20 64 43
        bcc L3C50             ; 3C6C  90 E2
        jsr npc_gate          ; 3C6E  20 C2 43
        bcc L3CAE             ; 3C71  90 3B
        lda D09F1             ; 3C73  AD F1 09
        bne L3CAE             ; 3C76  D0 36
        jsr find_gift_item    ; 3C78  20 4E 3D
        ldx D09F0             ; 3C7B  AE F0 09
        lda npc_flags,x       ; 3C7E  BD 80 23
        and #$7F              ; 3C81  29 7F
        cmp day               ; 3C83  CD 62 0A
        bne L3CAE             ; 3C86  D0 26
        jsr print_inline      ; 3C88  20 09 80
        .byte $49,$C3,$43,$4F,$4D,$45,$20,$42,$41,$43,$4B,$20,$54,$4F,$4D,$4F; 3C8B  I.COME BACK TOMO
        .byte $52,$52,$4F,$57,$2C,$20,$4D,$59,$20,$46,$52,$49,$45,$4E,$44,$FF; 3C9B  RROW, MY FRIEND.
        jmp LAC12             ; 3CAB  4C 12 AC
L3CAE:    ; <- 3C71 3C76 3C86
        jsr npc_gate          ; 3CAE  20 C2 43
        bcc L3CBD             ; 3CB1  90 0A
        lda D09E8             ; 3CB3  AD E8 09
        pha                   ; 3CB6  48
        lda D09E7             ; 3CB7  AD E7 09
        jmp L3CC4             ; 3CBA  4C C4 3C
L3CBD:    ; <- 3CB1
        lda D09EC             ; 3CBD  AD EC 09
        pha                   ; 3CC0  48
        lda D09EB             ; 3CC1  AD EB 09
L3CC4:    ; <- 3CBA
        bne L3CCA             ; 3CC4  D0 04
        pla                   ; 3CC6  68
        jmp L439A             ; 3CC7  4C 9A 43
L3CCA:    ; <- 3CC4
        ldx #$49              ; 3CCA  A2 49
        ldy #$C3              ; 3CCC  A0 C3
        jsr print_message     ; 3CCE  20 15 3C
        pla                   ; 3CD1  68
        beq L3CDB             ; 3CD2  F0 07
        ldx #$71              ; 3CD4  A2 71
        ldy #$C3              ; 3CD6  A0 C3
        jsr print_message     ; 3CD8  20 15 3C
L3CDB:    ; <- 3CD2
        ldx D09F0             ; 3CDB  AE F0 09
        lda npc_flags,x       ; 3CDE  BD 80 23
        and #$80              ; 3CE1  29 80
        ora day               ; 3CE3  0D 62 0A
        sta npc_flags,x       ; 3CE6  9D 80 23
        jsr npc_gate          ; 3CE9  20 C2 43
        bcc L3D0C             ; 3CEC  90 1E
        lda D09F1             ; 3CEE  AD F1 09
        beq L3D08             ; 3CF1  F0 15
        cmp #$40              ; 3CF3  C9 40
        beq L3D08             ; 3CF5  F0 11
        and #$F0              ; 3CF7  29 F0
        cmp #$20              ; 3CF9  C9 20
        beq L3D08             ; 3CFB  F0 0B
        lda D09F1             ; 3CFD  AD F1 09
        cmp #$D0              ; 3D00  C9 D0
        bne L3D0C             ; 3D02  D0 08
        lda #$01              ; 3D04  A9 01
        sta $CE               ; 3D06  85 CE
L3D08:    ; <- 3CF1 3CF5 3CFB
        lda #$01              ; 3D08  A9 01
        sta $CC               ; 3D0A  85 CC
L3D0C:    ; <- 3CEC 3D02
        lda D09F1             ; 3D0C  AD F1 09
        cmp #$40              ; 3D0F  C9 40
        bne L3D35             ; 3D11  D0 22
        ldx D09F0             ; 3D13  AE F0 09
        lda npc_flags,x       ; 3D16  BD 80 23
        bit D0AA7             ; 3D19  2C A7 0A
        bne L3D35             ; 3D1C  D0 17
        ora #$80              ; 3D1E  09 80
        sta npc_flags,x       ; 3D20  9D 80 23
        clc                   ; 3D23  18
        lda spirit_limit      ; 3D24  AD 67 0A
        adc #$05              ; 3D27  69 05
        sta spirit_limit      ; 3D29  8D 67 0A
        sta spirit_energy     ; 3D2C  8D 63 0A
        jsr play_random_tune  ; 3D2F  20 38 3D
        jsr gain_spirit_power ; 3D32  20 A9 3D
L3D35:    ; <- 3D11 3D1C
        jmp LAC12             ; 3D35  4C 12 AC
play_random_tune:    ; <- 3C12 3D2F 3E10 4018 4183
        ldx #$A0              ; 3D38  A2 A0
        jsr jt_delay          ; 3D3A  20 12 80
        jsr rnd               ; 3D3D  20 39 80
        and #$07              ; 3D40  29 07
        clc                   ; 3D42  18
        adc #$02              ; 3D43  69 02
        jsr jt_music_play     ; 3D45  20 00 28
L3D48:    ; <- 3D4B
        lda music_on          ; 3D48  AD 95 0A
        bne L3D48             ; 3D4B  D0 FB
        rts                   ; 3D4D  60
find_gift_item:    ; <- 3C78
        lda D09EF             ; 3D4E  AD EF 09
        cmp #$10              ; 3D51  C9 10
        bne L3D56             ; 3D53  D0 01
        rts                   ; 3D55  60
L3D56:    ; <- 3D53
        ldx #$FF              ; 3D56  A2 FF
L3D58:    ; <- 3D88 3D93 3D99 3DA1 3DA6
        dex                   ; 3D58  CA
        cpx #$FF              ; 3D59  E0 FF
        bne L3D83             ; 3D5B  D0 26
        pla                   ; 3D5D  68
        pla                   ; 3D5E  68
        jsr print_inline      ; 3D5F  20 09 80
        .byte $49,$C3,$49,$20,$48,$41,$56,$45,$20,$4E,$4F,$54,$48,$49,$4E,$47; 3D62  I.I HAVE NOTHING
        .byte $20,$4D,$4F,$52,$45,$20,$54,$4F,$20,$47,$49,$56,$45,$FF; 3D72   MORE TO GIVE.
        jmp LAC12             ; 3D80  4C 12 AC
L3D83:    ; <- 3D5B
        lda object_table,x    ; 3D83  BD 00 0D
        cmp room_lo           ; 3D86  C5 86
        bne L3D58             ; 3D88  D0 CE
        lda D0F00,x           ; 3D8A  BD 00 0F
        and #$80              ; 3D8D  29 80
        bne L3D97             ; 3D8F  D0 06
        lda room_hi           ; 3D91  A5 87
        bne L3D58             ; 3D93  D0 C3
        beq L3D9B             ; 3D95  F0 04
L3D97:    ; <- 3D8F
        lda room_hi           ; 3D97  A5 87
        beq L3D58             ; 3D99  F0 BD
L3D9B:    ; <- 3D95
        lda D0F00,x           ; 3D9B  BD 00 0F
        bit D0AA6             ; 3D9E  2C A6 0A
        beq L3D58             ; 3DA1  F0 B5
        bit D0AA5             ; 3DA3  2C A5 0A
        bne L3D58             ; 3DA6  D0 B0
        rts                   ; 3DA8  60
gain_spirit_power:    ; <- 3D32 418E
        ldx #$00              ; 3DA9  A2 00
        lda spirit_limit      ; 3DAB  AD 67 0A
L3DAE:    ; <- 3DB2
        sec                   ; 3DAE  38
        sbc #$05              ; 3DAF  E9 05
        inx                   ; 3DB1  E8
        bcs L3DAE             ; 3DB2  B0 FA
        cpx #$08              ; 3DB4  E0 08
        bcs vision_sequence   ; 3DB6  B0 5B
        txa                   ; 3DB8  8A
        pha                   ; 3DB9  48
        jsr LAC12             ; 3DBA  20 12 AC
        jsr print_inline      ; 3DBD  20 09 80
        .byte $49,$C3,$43,$4F,$4E,$47,$52,$41,$54,$55,$4C,$41,$54,$49,$4F,$4E; 3DC0  I.CONGRATULATION
        .byte $53,$20,$51,$55,$45,$53,$54,$45,$52,$2C,$20,$59,$4F,$55,$20,$48; 3DD0  S QUESTER, YOU H
        .byte $41,$56,$45,$FF                         ; 3DE0  AVE.
        jsr print_inline      ; 3DE4  20 09 80
        .byte $71,$C3,$47,$41,$49,$4E,$45,$44,$20,$54,$48,$45,$20,$50,$4F,$57; 3DE7  q.GAINED THE POW
        .byte $45,$52,$20,$54,$4F,$FF                 ; 3DF7  ER TO.
        pla                   ; 3DFD  68
        tay                   ; 3DFE  A8
; index 1 (spirit limit 0-4) reads past the table; unreachable, the limit is always a multiple of 5 here
        ldx L4018+2,y         ; 3DFF  BE 1A 40
        ldy #$00              ; 3E02  A0 00
L3E04:    ; <- 3E0E
        lda skill_names,x     ; 3E04  BD 22 40
        bmi L3E10             ; 3E07  30 07
        sta DC385,y           ; 3E09  99 85 C3
        iny                   ; 3E0C  C8
        inx                   ; 3E0D  E8
        bpl L3E04             ; 3E0E  10 F4
L3E10:    ; <- 3E07
        jsr play_random_tune  ; 3E10  20 38 3D
vision_sequence:    ; <- 3DB6
        lda vision_count      ; 3E13  A5 DC
        cmp #$05              ; 3E15  C9 05
        bne L3E1A             ; 3E17  D0 01
        rts                   ; 3E19  60
L3E1A:    ; <- 3E17
        jsr LAC12             ; 3E1A  20 12 AC
        jsr print_inline      ; 3E1D  20 09 80
        .byte $49,$C3,$41,$20,$56,$49,$53,$49,$4F,$4E,$20,$43,$4F,$4D,$45,$53; 3E20  I.A VISION COMES
        .byte $20,$54,$4F,$20,$59,$4F,$55,$3A,$FF     ; 3E30   TO YOU:.
        lda vision_count      ; 3E39  A5 DC
        bne L3EA6             ; 3E3B  D0 69
        jsr print_inline      ; 3E3D  20 09 80
        .byte $71,$C3,$54,$48,$45,$20,$42,$4F,$44,$59,$20,$4F,$46,$20,$52,$41; 3E40  q.THE BODY OF RA
        .byte $41,$4D,$4F,$2C,$20,$54,$48,$45,$20,$53,$50,$49,$52,$49,$54,$20; 3E50  AMO, THE SPIRIT 
        .byte $42,$4C,$45,$53,$53,$45,$44,$2C,$20,$20,$53,$49,$4E,$4B,$53,$20; 3E60  BLESSED,  SINKS 
        .byte $44,$45,$45,$50,$20,$42,$45,$4E,$45,$41,$54,$48,$20,$54,$48,$45; 3E70  DEEP BENEATH THE
        .byte $20,$53,$55,$52,$46,$41,$43,$45,$20,$4F,$46,$20,$54,$48,$45,$20; 3E80   SURFACE OF THE 
        .byte $20,$20,$42,$4F,$54,$54,$4F,$4D,$4C,$45,$53,$53,$20,$4C,$41,$4B; 3E90    BOTTOMLESS LAK
        .byte $45,$2E,$FF                             ; 3EA0  E..
        jmp L4016             ; 3EA3  4C 16 40
L3EA6:    ; <- 3E3B
        cmp #$01              ; 3EA6  C9 01
        bne L3EF4             ; 3EA8  D0 4A
        jsr print_inline      ; 3EAA  20 09 80
        .byte $71,$C3,$41,$4C,$4C,$20,$4F,$46,$20,$47,$52,$45,$45,$4E,$2D,$53; 3EAD  q.ALL OF GREEN-S
        .byte $4B,$59,$20,$4D,$4F,$55,$52,$4E,$20,$46,$4F,$52,$20,$52,$41,$41; 3EBD  KY MOURN FOR RAA
        .byte $4D,$4F,$2C,$20,$20,$20,$20,$20,$20,$20,$54,$48,$45,$49,$52,$20; 3ECD  MO,       THEIR 
        .byte $4C,$4F,$53,$54,$20,$53,$50,$49,$52,$49,$54,$2D,$4C,$45,$41,$44; 3EDD  LOST SPIRIT-LEAD
        .byte $45,$52,$2E,$FF                         ; 3EED  ER..
        jmp L4016             ; 3EF1  4C 16 40
L3EF4:    ; <- 3EA8
        cmp #$02              ; 3EF4  C9 02
        bne L3F4E             ; 3EF6  D0 56
        jsr print_inline      ; 3EF8  20 09 80
        .byte $71,$C3,$52,$41,$41,$4D,$4F,$2C,$20,$54,$48,$45,$20,$4C,$4F,$53; 3EFB  q.RAAMO, THE LOS
        .byte $54,$20,$53,$4F,$4E,$2C,$20,$52,$49,$53,$45,$53,$20,$54,$4F,$20; 3F0B  T SON, RISES TO 
        .byte $52,$45,$55,$4E,$49,$54,$45,$20,$20,$20,$54,$48,$45,$20,$45,$52; 3F1B  REUNITE   THE ER
        .byte $44,$4C,$49,$4E,$47,$53,$20,$41,$4E,$44,$20,$4B,$49,$4E,$44,$41; 3F2B  DLINGS AND KINDA
        .byte $52,$20,$4F,$46,$20,$47,$52,$45,$45,$4E,$2D,$53,$4B,$59,$2E,$FF; 3F3B  R OF GREEN-SKY..
        jmp L4016             ; 3F4B  4C 16 40
L3F4E:    ; <- 3EF6
        cmp #$03              ; 3F4E  C9 03
        bne L3FBB             ; 3F50  D0 69
        jsr print_inline      ; 3F52  20 09 80
        .byte $71,$C3,$41,$20,$42,$4F,$44,$59,$20,$57,$41,$53,$48,$45,$53,$20; 3F55  q.A BODY WASHES 
        .byte $55,$50,$20,$46,$52,$4F,$4D,$20,$54,$48,$45,$20,$42,$4F,$54,$54; 3F65  UP FROM THE BOTT
        .byte $4F,$4D,$4C,$45,$53,$53,$20,$20,$20,$20,$4C,$41,$4B,$45,$2E,$20; 3F75  OMLESS    LAKE. 
        .byte $54,$48,$45,$20,$42,$4F,$59,$20,$41,$50,$50,$45,$41,$52,$53,$20; 3F85  THE BOY APPEARS 
        .byte $44,$45,$41,$44,$20,$42,$55,$54,$20,$59,$4F,$55,$20,$20,$20,$20; 3F95  DEAD BUT YOU    
        .byte $20,$20,$43,$41,$4E,$27,$54,$20,$42,$45,$20,$53,$55,$52,$45,$2E; 3FA5    CAN'T BE SURE.
        .byte $2E,$2E,$FF                             ; 3FB5  ...
        jmp L4016             ; 3FB8  4C 16 40
L3FBB:    ; <- 3F50
        jsr print_inline      ; 3FBB  20 09 80
        .byte $71,$C3,$4F,$4E,$20,$41,$20,$4E,$41,$52,$52,$4F,$57,$20,$52,$4F; 3FBE  q.ON A NARROW RO
        .byte $43,$4B,$20,$4C,$45,$44,$47,$45,$20,$52,$41,$41,$4D,$4F,$20,$4C; 3FCE  CK LEDGE RAAMO L
        .byte $49,$56,$45,$53,$2C,$20,$20,$20,$20,$20,$54,$52,$41,$50,$50,$45; 3FDE  IVES,     TRAPPE
        .byte $44,$20,$49,$4E,$20,$54,$48,$45,$20,$43,$41,$56,$45,$52,$4E,$53; 3FEE  D IN THE CAVERNS
        .byte $20,$44,$45,$45,$50,$20,$42,$45,$4C,$4F,$57,$20,$54,$48,$45,$20; 3FFE   DEEP BELOW THE 
        .byte $20,$20,$52,$4F,$4F,$54,$2E,$FF         ; 400E    ROOT..
L4016:    ; <- 3EA3 3EF1 3F4B 3FB8
        inc vision_count      ; 4016  E6 DC
        jsr play_random_tune  ; 4018  20 38 3D
        rts                   ; 401B  60
skill_msg_offset:
        .byte $00,$0F,$1E,$2C,$37,$46                 ; 401C  ...,7F
skill_names:    ; <- 3E04
        .byte $50,$45,$4E,$53,$45,$20,$45,$4D,$4F,$54,$49,$4F,$4E,$53,$FF,$50; 4022  PENSE EMOTIONS.P
        .byte $45,$4E,$53,$45,$20,$4D,$45,$53,$53,$41,$47,$45,$53,$FF,$48,$45; 4032  ENSE MESSAGES.HE
        .byte $41,$4C,$20,$59,$4F,$55,$52,$53,$45,$4C,$46,$FF,$47,$52,$55,$4E; 4042  AL YOURSELF.GRUN
        .byte $53,$50,$52,$45,$4B,$45,$FF,$4B,$49,$4E,$49,$50,$4F,$52,$54,$20; 4052  SPREKE.KINIPORT 
        .byte $54,$4F,$4F,$4C,$53,$FF,$4B,$49,$4E,$49,$50,$4F,$52,$54,$20,$59; 4062  TOOLS.KINIPORT Y
        .byte $4F,$55,$52,$20,$42,$4F,$44,$59,$FF     ; 4072  OUR BODY.
verb_pense:    ; <- 3C06
        jsr L9506             ; 407B  20 06 95
        lda blk_creature      ; 407E  AD E0 09
        bne L4097             ; 4081  D0 14
        jsr print_inline      ; 4083  20 09 80
        .byte $49,$C3,$50,$45,$4E,$53,$45,$20,$57,$48,$4F,$4D,$3F,$FF; 4086  I.PENSE WHOM?.
        jmp LAC12             ; 4094  4C 12 AC
L4097:    ; <- 4081
        lda spirit_limit      ; 4097  AD 67 0A
        cmp #$05              ; 409A  C9 05
        bcs L40BF             ; 409C  B0 21
        jsr print_inline      ; 409E  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$4C,$41,$43,$4B,$20,$54,$48,$45,$20,$53; 40A1  I.YOU LACK THE S
        .byte $50,$52,$49,$54,$20,$53,$4B,$49,$4C,$4C,$FF; 40B1  PRIT SKILL.
        jmp LAC12             ; 40BC  4C 12 AC
L40BF:    ; <- 409C
        lda spirit_energy     ; 40BF  AD 63 0A
        bne L40E8             ; 40C2  D0 24
        jsr print_inline      ; 40C4  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$4E,$45,$45,$44,$20,$4D,$4F,$52,$45,$20; 40C7  I.YOU NEED MORE 
        .byte $53,$50,$49,$52,$49,$54,$20,$45,$4E,$45,$52,$47,$59,$FF; 40D7  SPIRIT ENERGY.
        jmp LAC12             ; 40E5  4C 12 AC
L40E8:    ; <- 40C2
        jsr print_inline      ; 40E8  20 09 80
        .byte $49,$C3,$45,$4D,$4F,$54,$49,$4F,$4E,$3A,$FF; 40EB  I.EMOTION:.
        jsr npc_gate          ; 40F6  20 C2 43
        bcc L4103             ; 40F9  90 08
        lda D09E9             ; 40FB  AD E9 09
        bne L410B             ; 40FE  D0 0B
        jmp L439A             ; 4100  4C 9A 43
L4103:    ; <- 40F9
        lda D09ED             ; 4103  AD ED 09
        bne L410B             ; 4106  D0 03
        jmp L439A             ; 4108  4C 9A 43
L410B:    ; <- 40FE 4106
        ldx #$52              ; 410B  A2 52
        ldy #$C3              ; 410D  A0 C3
        jsr print_message     ; 410F  20 15 3C
        dec spirit_energy     ; 4112  CE 63 0A
        lda spirit_limit      ; 4115  AD 67 0A
        cmp #$0A              ; 4118  C9 0A
        bcs L411F             ; 411A  B0 03
L411C:    ; <- 4122 4127 4139
        jmp LAC12             ; 411C  4C 12 AC
L411F:    ; <- 411A
        lda spirit_energy     ; 411F  AD 63 0A
        beq L411C             ; 4122  F0 F8
        jsr npc_adjacent      ; 4124  20 64 43
        bcc L411C             ; 4127  90 F3
        lda D09F1             ; 4129  AD F1 09
        cmp #$01              ; 412C  C9 01
        bne L413B             ; 412E  D0 0B
        ldx D09F0             ; 4130  AE F0 09
        lda npc_flags,x       ; 4133  BD 80 23
        bit D0AA7             ; 4136  2C A7 0A
        bne L411C             ; 4139  D0 E1
L413B:    ; <- 412E
        jsr print_inline      ; 413B  20 09 80
        .byte $99,$C3,$4D,$45,$53,$53,$41,$47,$45,$3A,$FF; 413E  ..MESSAGE:.
        jsr npc_gate          ; 4149  20 C2 43
        bcc L4156             ; 414C  90 08
        lda D09EA             ; 414E  AD EA 09
        bne L415E             ; 4151  D0 0B
        jmp L43AE             ; 4153  4C AE 43
L4156:    ; <- 414C
        lda D09EE             ; 4156  AD EE 09
        bne L415E             ; 4159  D0 03
        jmp L43AE             ; 415B  4C AE 43
L415E:    ; <- 4151 4159
        ldx #$C1              ; 415E  A2 C1
        ldy #$C3              ; 4160  A0 C3
        jsr print_message     ; 4162  20 15 3C
        dec spirit_energy     ; 4165  CE 63 0A
        lda D09F1             ; 4168  AD F1 09
        cmp #$01              ; 416B  C9 01
        bne L4191             ; 416D  D0 22
        ldx D09F0             ; 416F  AE F0 09
        lda npc_flags,x       ; 4172  BD 80 23
        ora #$80              ; 4175  09 80
        sta npc_flags,x       ; 4177  9D 80 23
        inc spirit_limit      ; 417A  EE 67 0A
        lda spirit_limit      ; 417D  AD 67 0A
        sta spirit_energy     ; 4180  8D 63 0A
        jsr play_random_tune  ; 4183  20 38 3D
        inc pense_msg_count   ; 4186  E6 DD
        lda pense_msg_count   ; 4188  A5 DD
        cmp #$05              ; 418A  C9 05
        bne L4191             ; 418C  D0 03
        jsr gain_spirit_power ; 418E  20 A9 3D
L4191:    ; <- 416D 418C
        jmp LAC12             ; 4191  4C 12 AC
verb_buy:    ; <- 3C09
        jsr L9506             ; 4194  20 06 95
        jsr L4338             ; 4197  20 38 43
        jsr npc_adjacent      ; 419A  20 64 43
        bcs L41A2             ; 419D  B0 03
        jmp L439A             ; 419F  4C 9A 43
L41A2:    ; <- 419D
        ldx #$4A              ; 41A2  A2 4A
L41A4:    ; <- 41AD
        lda D0F6C,x           ; 41A4  BD 6C 0F
        bit D0AA5             ; 41A7  2C A5 0A
        bne L41CC             ; 41AA  D0 20
        dex                   ; 41AC  CA
        bpl L41A4             ; 41AD  10 F5
        jsr print_inline      ; 41AF  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$4E,$45,$45,$44,$20,$4D,$4F,$52,$45,$20; 41B2  I.YOU NEED MORE 
        .byte $54,$4F,$4B,$45,$4E,$53,$FF             ; 41C2  TOKENS.
        jmp LAC12             ; 41C9  4C 12 AC
L41CC:    ; <- 41AA
        lda carried_weight    ; 41CC  AD 7A 0A
        clc                   ; 41CF  18
        adc #$04              ; 41D0  69 04
        cmp carry_limit       ; 41D2  CD 6C 0A
        bcc L41FF             ; 41D5  90 28
        jsr print_inline      ; 41D7  20 09 80
        .byte $49,$C3,$53,$4F,$52,$52,$59,$2C,$20,$59,$4F,$55,$27,$52,$45,$20; 41DA  I.SORRY, YOU'RE 
        .byte $43,$41,$52,$52,$59,$49,$4E,$47,$20,$54,$4F,$4F,$20,$4D,$55,$43; 41EA  CARRYING TOO MUC
        .byte $48,$FF                                 ; 41FA  H.
        jmp LAC12             ; 41FC  4C 12 AC
L41FF:    ; <- 41D5
        lda #$00              ; 41FF  A9 00
        sta D0F6C,x           ; 4201  9D 6C 0F
        ldy #$08              ; 4204  A0 08
        jsr LAC0C             ; 4206  20 0C AC
        lda #$01              ; 4209  A9 01
        sta $CC               ; 420B  85 CC
        jsr print_inline      ; 420D  20 09 80
        .byte $49,$C3,$54,$41,$4B,$45,$20,$57,$48,$49,$43,$48,$45,$56,$45,$52; 4210  I.TAKE WHICHEVER
        .byte $20,$4F,$4E,$45,$20,$50,$4C,$45,$41,$53,$45,$53,$20,$59,$4F,$55; 4220   ONE PLEASES YOU
        .byte $FF                                     ; 4230  .
        jmp LAC12             ; 4231  4C 12 AC
verb_sell:    ; <- 3C0C
        jsr L9506             ; 4234  20 06 95
        jsr L4338             ; 4237  20 38 43
        jsr npc_adjacent      ; 423A  20 64 43
        bcs L4242             ; 423D  B0 03
        jmp L439A             ; 423F  4C 9A 43
L4242:    ; <- 423D
        jsr print_inline      ; 4242  20 09 80
        .byte $49,$C3,$57,$48,$41,$54,$20,$57,$49,$4C,$4C,$20,$59,$4F,$55,$20; 4245  I.WHAT WILL YOU 
        .byte $53,$45,$4C,$4C,$3F,$FF                 ; 4255  SELL?.
        lda #$FF              ; 425B  A9 FF
        sta D0A54             ; 425D  8D 54 0A
        sta D0A55             ; 4260  8D 55 0A
        sta $D2               ; 4263  85 D2
        jsr jt_wait_input     ; 4265  20 27 80
L4268:    ; <- 4294 429D 42A2 42BE
        inc D0A54             ; 4268  EE 54 0A
        ldx D0A54             ; 426B  AE 54 0A
        cpx #$FF              ; 426E  E0 FF
        bne L428E             ; 4270  D0 1C
        stx D0A55             ; 4272  8E 55 0A
        jsr print_inline      ; 4275  20 09 80
        .byte $5E,$C3,$4E,$4F,$54,$48,$49,$4E,$47,$20,$20,$20,$20,$20,$20,$20; 4278  ^.NOTHING       
        .byte $20,$20,$FF                             ; 4288    .
        jmp L42B2             ; 428B  4C B2 42
L428E:    ; <- 4270
        lda D0F00,x           ; 428E  BD 00 0F
        bit D0AA5             ; 4291  2C A5 0A
        beq L4268             ; 4294  F0 D2
        txa                   ; 4296  8A
        jsr LAC09             ; 4297  20 09 AC
        cpy D0A55             ; 429A  CC 55 0A
        beq L4268             ; 429D  F0 C9
        lda D4329,y           ; 429F  B9 29 43
        beq L4268             ; 42A2  F0 C4
        sty D0A55             ; 42A4  8C 55 0A
        lda #$5E              ; 42A7  A9 5E
        sta $80               ; 42A9  85 80
        lda #$C3              ; 42AB  A9 C3
        sta $81               ; 42AD  85 81
        jsr LAC0F             ; 42AF  20 0F AC
L42B2:    ; <- 428B
        jsr LA818             ; 42B2  20 18 A8
L42B5:    ; <- 42BC
        jsr jt_get_input      ; 42B5  20 0F 80
        bne L42C1             ; 42B8  D0 07
        lda $99               ; 42BA  A5 99
        bpl L42B5             ; 42BC  10 F7
        jmp L4268             ; 42BE  4C 68 42
L42C1:    ; <- 42B8
        jsr L9506             ; 42C1  20 06 95
        ldx D0A54             ; 42C4  AE 54 0A
        cpx #$FF              ; 42C7  E0 FF
        bne L42CC             ; 42C9  D0 01
        rts                   ; 42CB  60
L42CC:    ; <- 42C9
        ldx #$4A              ; 42CC  A2 4A
L42CE:    ; <- 42D4
        lda D0F6C,x           ; 42CE  BD 6C 0F
        beq L42F8             ; 42D1  F0 25
        dex                   ; 42D3  CA
        bpl L42CE             ; 42D4  10 F8
        jsr print_inline      ; 42D6  20 09 80
        .byte $49,$C3,$53,$4F,$52,$52,$59,$2C,$20,$49,$27,$4D,$20,$4E,$4F,$54; 42D9  I.SORRY, I'M NOT
        .byte $20,$49,$4E,$54,$45,$52,$45,$53,$54,$45,$44,$FF; 42E9   INTERESTED.
        jmp LAC12             ; 42F5  4C 12 AC
L42F8:    ; <- 42D1
        lda #$60              ; 42F8  A9 60
        sta D0F6C,x           ; 42FA  9D 6C 0F
        ldx D0A54             ; 42FD  AE 54 0A
        lda #$00              ; 4300  A9 00
        sta D0F00,x           ; 4302  9D 00 0F
        txa                   ; 4305  8A
        jsr LAC09             ; 4306  20 09 AC
        jsr LAC0C             ; 4309  20 0C AC
        inc carried_weight    ; 430C  EE 7A 0A
        jsr print_inline      ; 430F  20 09 80
        .byte $49,$C3,$48,$45,$52,$45,$27,$53,$20,$59,$4F,$55,$52,$20,$54,$4F; 4312  I.HERE'S YOUR TO
        .byte $4B,$45,$4E,$FF                         ; 4322  KEN.
        jmp LAC12             ; 4326  4C 12 AC
D4329:    ; <- 429F
        .byte $00,$00,$01,$00,$01,$01,$01,$01,$00,$01,$01,$01,$00,$00,$00; 4329  ...............
L4338:    ; <- 4197 4237
        lda D09F1             ; 4338  AD F1 09
        cmp #$80              ; 433B  C9 80
        beq L4363             ; 433D  F0 24
        jsr print_inline      ; 433F  20 09 80
        .byte $49,$C3,$54,$48,$45,$52,$45,$20,$49,$53,$20,$4E,$4F,$20,$4D,$45; 4342  I.THERE IS NO ME
        .byte $52,$43,$48,$41,$4E,$54,$20,$48,$45,$52,$45,$FF; 4352  RCHANT HERE.
        pla                   ; 435E  68
        pla                   ; 435F  68
        jmp LAC12             ; 4360  4C 12 AC
L4363:    ; <- 433D
        rts                   ; 4363  60
npc_adjacent:    ; <- 3C69 4124 419A 423A 43EB
        lda D0A10             ; 4364  AD 10 0A
        clc                   ; 4367  18
        adc D0A37             ; 4368  6D 37 0A
        cmp D0A80             ; 436B  CD 80 0A
        beq L4379             ; 436E  F0 09
        clc                   ; 4370  18
        adc D0A37             ; 4371  6D 37 0A
        cmp D0A80             ; 4374  CD 80 0A
        bne L4398             ; 4377  D0 1F
L4379:    ; <- 436E
        ldy D0A18             ; 4379  AC 18 0A
        cpy D0A81             ; 437C  CC 81 0A
        beq L438E             ; 437F  F0 0D
        iny                   ; 4381  C8
        cpy D0A81             ; 4382  CC 81 0A
        beq L438E             ; 4385  F0 07
        dey                   ; 4387  88
        dey                   ; 4388  88
        cpy D0A81             ; 4389  CC 81 0A
        bne L4398             ; 438C  D0 0A
L438E:    ; <- 437F 4385
        lda D0A37             ; 438E  AD 37 0A
        cmp D0A85             ; 4391  CD 85 0A
        beq L4398             ; 4394  F0 02
        sec                   ; 4396  38
        rts                   ; 4397  60
L4398:    ; <- 4377 438C 4394
        clc                   ; 4398  18
        rts                   ; 4399  60
L439A:    ; <- 3CC7 4100 4108 419F 423F 4481
        jsr print_inline      ; 439A  20 09 80
        .byte $57,$C3,$4E,$4F,$20,$52,$45,$53,$50,$4F,$4E,$53,$45,$FF; 439D  W.NO RESPONSE.
        jmp LAC12             ; 43AB  4C 12 AC
L43AE:    ; <- 4153 415B
        jsr print_inline      ; 43AE  20 09 80
        .byte $A2,$C3,$4E,$4F,$20,$52,$45,$53,$50,$4F,$4E,$53,$45,$FF; 43B1  ..NO RESPONSE.
        jmp LAC12             ; 43BF  4C 12 AC
npc_gate:    ; <- 3C6E 3CAE 3CE9 40F6 4149
        ldx npc_req_stat      ; 43C2  AE 8F 0A
        lda standing_kindar,x ; 43C5  BD 68 0A
        cmp npc_req_level     ; 43C8  CD 8E 0A
        rts                   ; 43CB  60
verb_offer:    ; <- 3C0F
        jsr L9506             ; 43CC  20 06 95
        lda blk_creature      ; 43CF  AD E0 09
        bne L43EB             ; 43D2  D0 17
L43D4:    ; <- 43EE
        jsr print_inline      ; 43D4  20 09 80
        .byte $49,$C3,$4F,$46,$46,$45,$52,$20,$54,$4F,$20,$57,$48,$4F,$4D,$3F; 43D7  I.OFFER TO WHOM?
        .byte $FF                                     ; 43E7  .
        jmp LAC12             ; 43E8  4C 12 AC
L43EB:    ; <- 43D2
        jsr npc_adjacent      ; 43EB  20 64 43
        bcc L43D4             ; 43EE  90 E4
        jsr print_inline      ; 43F0  20 09 80
        .byte $49,$C3,$4F,$46,$46,$45,$52,$20,$57,$48,$41,$54,$3F,$FF; 43F3  I.OFFER WHAT?.
        lda #$FF              ; 4401  A9 FF
        sta D0A54             ; 4403  8D 54 0A
        sta $D2               ; 4406  85 D2
        sta D0A55             ; 4408  8D 55 0A
        jsr jt_wait_input     ; 440B  20 27 80
L440E:    ; <- 443A 4443 445F
        inc D0A54             ; 440E  EE 54 0A
        ldx D0A54             ; 4411  AE 54 0A
        cpx #$FF              ; 4414  E0 FF
        bne L4434             ; 4416  D0 1C
        stx D0A55             ; 4418  8E 55 0A
        jsr print_inline      ; 441B  20 09 80
        .byte $56,$C3,$4E,$4F,$54,$48,$49,$4E,$47,$20,$20,$20,$20,$20,$20,$20; 441E  V.NOTHING       
        .byte $20,$20,$FF                             ; 442E    .
        jmp L4453             ; 4431  4C 53 44
L4434:    ; <- 4416
        lda D0F00,x           ; 4434  BD 00 0F
        bit D0AA5             ; 4437  2C A5 0A
        beq L440E             ; 443A  F0 D2
        txa                   ; 443C  8A
        jsr LAC09             ; 443D  20 09 AC
        cpy D0A55             ; 4440  CC 55 0A
        beq L440E             ; 4443  F0 C9
        sty D0A55             ; 4445  8C 55 0A
        lda #$56              ; 4448  A9 56
        sta $80               ; 444A  85 80
        lda #$C3              ; 444C  A9 C3
        sta $81               ; 444E  85 81
        jsr LAC0F             ; 4450  20 0F AC
L4453:    ; <- 4431
        jsr LA818             ; 4453  20 18 A8
L4456:    ; <- 445D
        jsr jt_get_input      ; 4456  20 0F 80
        bne L4462             ; 4459  D0 07
        lda $99               ; 445B  A5 99
        bpl L4456             ; 445D  10 F7
        jmp L440E             ; 445F  4C 0E 44
L4462:    ; <- 4459
        jsr L9506             ; 4462  20 06 95
        ldx D0A54             ; 4465  AE 54 0A
        cpx #$FF              ; 4468  E0 FF
        bne L446F             ; 446A  D0 03
        jmp LAC12             ; 446C  4C 12 AC
L446F:    ; <- 446A
        ldy D0A55             ; 446F  AC 55 0A
        lda D09F0             ; 4472  AD F0 09
        cmp #$49              ; 4475  C9 49
        beq L449C             ; 4477  F0 23
        cmp #$34              ; 4479  C9 34
        beq L44AC             ; 447B  F0 2F
        cmp #$35              ; 447D  C9 35
        beq L44BF             ; 447F  F0 3E
        jmp L439A             ; 4481  4C 9A 43
L4484:    ; <- 44A2 44AE 44C1
        jsr print_inline      ; 4484  20 09 80
        .byte $49,$C3,$54,$48,$41,$54,$20,$57,$4F,$4E,$27,$54,$20,$48,$45,$4C; 4487  I.THAT WON'T HEL
        .byte $50,$FF                                 ; 4497  P.
        jmp LAC12             ; 4499  4C 12 AC
L449C:    ; <- 4477
        cpy #$07              ; 449C  C0 07
        beq L44A4             ; 449E  F0 04
        cpy #$0B              ; 44A0  C0 0B
        bne L4484             ; 44A2  D0 E0
L44A4:    ; <- 449E
        jsr L9C18             ; 44A4  20 18 9C
        pla                   ; 44A7  68
        pla                   ; 44A8  68
        jmp jt_main_menu      ; 44A9  4C 00 34
L44AC:    ; <- 447B
        cpy #$0A              ; 44AC  C0 0A
        bne L4484             ; 44AE  D0 D4
        inc $D0               ; 44B0  E6 D0
        lda $D0               ; 44B2  A5 D0
        cmp #$02              ; 44B4  C9 02
        bne L44C3             ; 44B6  D0 0B
        lda #$80              ; 44B8  A9 80
        sta D2334             ; 44BA  8D 34 23
        bne L44C3             ; 44BD  D0 04
L44BF:    ; <- 447F
        cpy #$08              ; 44BF  C0 08
        bne L4484             ; 44C1  D0 C1
L44C3:    ; <- 44B6 44BD
        lda #$01              ; 44C3  A9 01
        sta $CD               ; 44C5  85 CD
        lda #$00              ; 44C7  A9 00
        ldx D0A54             ; 44C9  AE 54 0A
        sta D0F00,x           ; 44CC  9D 00 0F
        jsr LAC0C             ; 44CF  20 0C AC
        jsr print_inline      ; 44D2  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$4D,$41,$59,$20,$45,$4E,$54,$45,$52,$FF; 44D5  I.YOU MAY ENTER.
        jmp LAC12             ; 44E5  4C 12 AC
        .byte $4C,$12,$AC,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 44E8  L...............
        .byte $00,$DF,$00,$00,$20,$A0,$00,$00         ; 44F8  .... ...
msg_table:
        .byte $53,$59,$4D,$50,$41,$54,$48,$59,$FF,$53,$55,$53,$50,$49,$43,$49; 4500  SYMPATHY.SUSPICI
        .byte $4F,$4E,$FF,$47,$4F,$4F,$44,$57,$49,$4C,$4C,$FF,$49,$4E,$54,$45; 4510  ON.GOODWILL.INTE
        .byte $52,$45,$53,$54,$FF,$52,$45,$53,$45,$4E,$54,$4D,$45,$4E,$54,$FF; 4520  REST.RESENTMENT.
        .byte $52,$45,$53,$45,$52,$56,$45,$FF,$41,$56,$41,$52,$49,$43,$45,$FF; 4530  RESERVE.AVARICE.
        .byte $43,$4F,$4D,$50,$41,$53,$53,$49,$4F,$4E,$FF,$44,$45,$43,$45,$49; 4540  COMPASSION.DECEI
        .byte $54,$FF,$41,$20,$4C,$49,$53,$54,$4C,$45,$53,$53,$20,$43,$41,$4C; 4550  T.A LISTLESS CAL
        .byte $4D,$FF,$47,$52,$45,$45,$44,$FF,$46,$55,$52,$54,$49,$56,$45,$4E; 4560  M.GREED.FURTIVEN
        .byte $45,$53,$53,$FF,$41,$50,$50,$52,$4F,$56,$41,$4C,$FF,$47,$52,$55; 4570  ESS.APPROVAL.GRU
        .byte $44,$47,$49,$4E,$47,$20,$49,$4E,$54,$45,$52,$45,$53,$54,$FF,$41; 4580  DGING INTEREST.A
        .byte $4E,$54,$41,$47,$4F,$4E,$49,$53,$4D,$FF,$41,$43,$43,$45,$50,$54; 4590  NTAGONISM.ACCEPT
        .byte $41,$4E,$43,$45,$FF,$47,$55,$49,$4C,$45,$FF,$42,$45,$4E,$45,$56; 45A0  ANCE.GUILE.BENEV
        .byte $4F,$4C,$45,$4E,$43,$45,$FF,$4C,$4F,$56,$45,$20,$41,$4E,$44,$20; 45B0  OLENCE.LOVE AND 
        .byte $53,$55,$50,$50,$4F,$52,$54,$FF,$4C,$4F,$56,$45,$20,$41,$4E,$44; 45C0  SUPPORT.LOVE AND
        .byte $20,$54,$52,$55,$53,$54,$FF,$48,$4F,$50,$45,$20,$41,$4E,$44,$20; 45D0   TRUST.HOPE AND 
        .byte $4A,$4F,$59,$FF,$49,$4E,$44,$49,$46,$46,$45,$52,$45,$4E,$43,$45; 45E0  JOY.INDIFFERENCE
        .byte $FF,$41,$50,$41,$54,$48,$59,$FF,$42,$4F,$52,$45,$44,$4F,$4D,$FF; 45F0  .APATHY.BOREDOM.
        .byte $43,$4F,$4E,$43,$45,$52,$4E,$FF,$50,$52,$49,$44,$45,$FF,$46,$52; 4600  CONCERN.PRIDE.FR
        .byte $49,$45,$4E,$44,$4C,$59,$20,$49,$4E,$54,$45,$52,$45,$53,$54,$FF; 4610  IENDLY INTEREST.
        .byte $4B,$49,$4E,$44,$4C,$59,$20,$57,$41,$52,$4D,$54,$48,$FF,$41,$4D; 4620  KINDLY WARMTH.AM
        .byte $49,$54,$59,$FF,$48,$4F,$53,$54,$49,$4C,$49,$54,$59,$FF,$44,$45; 4630  ITY.HOSTILITY.DE
        .byte $56,$49,$4F,$55,$53,$4E,$45,$53,$53,$FF,$52,$41,$47,$45,$FF,$49; 4640  VIOUSNESS.RAGE.I
        .byte $4E,$53,$41,$4E,$45,$20,$46,$41,$4E,$41,$54,$49,$43,$49,$53,$4D; 4650  NSANE FANATICISM
        .byte $FF,$4E,$4F,$54,$48,$49,$4E,$47,$FF,$44,$4F,$20,$59,$4F,$55,$20; 4660  .NOTHING.DO YOU 
        .byte $4E,$45,$45,$44,$20,$52,$45,$53,$54,$3F,$FF,$44,$4F,$20,$59,$4F; 4670  NEED REST?.DO YO
        .byte $55,$20,$4E,$45,$45,$44,$20,$46,$4F,$4F,$44,$3F,$FF,$44,$4F,$20; 4680  U NEED FOOD?.DO 
        .byte $59,$4F,$55,$20,$4E,$45,$45,$44,$20,$41,$20,$54,$4F,$4B,$45,$4E; 4690  YOU NEED A TOKEN
        .byte $3F,$FF,$44,$4F,$20,$59,$4F,$55,$20,$57,$49,$53,$48,$20,$54,$4F; 46A0  ?.DO YOU WISH TO
        .byte $20,$45,$41,$54,$3F,$FF,$57,$4F,$55,$4C,$44,$20,$59,$4F,$55,$20; 46B0   EAT?.WOULD YOU 
        .byte $4C,$49,$4B,$45,$20,$54,$4F,$20,$52,$45,$53,$54,$3F,$FF,$44,$4F; 46C0  LIKE TO REST?.DO
        .byte $20,$59,$4F,$55,$20,$57,$41,$4E,$54,$20,$54,$4F,$20,$42,$55,$59; 46D0   YOU WANT TO BUY
        .byte $20,$42,$45,$52,$52,$49,$45,$53,$3F,$FF,$4D,$41,$59,$20,$49,$20; 46E0   BERRIES?.MAY I 
        .byte $4F,$46,$46,$45,$52,$20,$41,$20,$54,$4F,$4B,$45,$4E,$3F,$FF,$49; 46F0  OFFER A TOKEN?.I
        .byte $20,$53,$55,$50,$50,$4F,$53,$45,$20,$59,$4F,$55,$20,$4E,$45,$45; 4700   SUPPOSE YOU NEE
        .byte $44,$20,$41,$20,$54,$4F,$4B,$45,$4E,$3F,$FF,$57,$4F,$55,$4C,$44; 4710  D A TOKEN?.WOULD
        .byte $20,$59,$4F,$55,$20,$4C,$49,$4B,$45,$20,$41,$20,$52,$4F,$41,$53; 4720   YOU LIKE A ROAS
        .byte $54,$45,$44,$20,$4C,$41,$50,$41,$4E,$3F,$FF,$57,$4F,$55,$4C,$44; 4730  TED LAPAN?.WOULD
        .byte $20,$59,$4F,$55,$20,$4C,$49,$4B,$45,$20,$54,$4F,$20,$42,$55,$59; 4740   YOU LIKE TO BUY
        .byte $20,$41,$20,$54,$52,$45,$4E,$43,$48,$45,$52,$20,$42,$45,$41,$4B; 4750   A TRENCHER BEAK
        .byte $3F,$FF,$57,$4F,$55,$4C,$44,$20,$59,$4F,$55,$20,$4C,$49,$4B,$45; 4760  ?.WOULD YOU LIKE
        .byte $20,$54,$4F,$20,$42,$55,$59,$20,$46,$52,$55,$49,$54,$20,$41,$4E; 4770   TO BUY FRUIT AN
        .byte $44,$20,$4E,$55,$54,$53,$3F,$FF,$48,$41,$56,$45,$20,$41,$20,$4E; 4780  D NUTS?.HAVE A N
        .byte $49,$43,$45,$20,$48,$4F,$4E,$45,$59,$20,$4C,$41,$4D,$50,$3F,$FF; 4790  ICE HONEY LAMP?.
        .byte $59,$4F,$55,$20,$4E,$45,$45,$44,$20,$41,$20,$53,$48,$55,$42,$41; 47A0  YOU NEED A SHUBA
        .byte $3F,$FF,$49,$27,$56,$45,$20,$46,$52,$45,$53,$48,$20,$50,$41,$4E; 47B0  ?.I'VE FRESH PAN
        .byte $20,$42,$52,$45,$41,$44,$FF,$56,$49,$4E,$45,$20,$52,$4F,$50,$45; 47C0   BREAD.VINE ROPE
        .byte $20,$49,$53,$20,$56,$45,$52,$59,$20,$55,$53,$45,$46,$55,$4C,$FF; 47D0   IS VERY USEFUL.
        .byte $44,$27,$4F,$4C,$20,$46,$41,$4C,$4C,$41,$20,$41,$57,$41,$49,$54; 47E0  D'OL FALLA AWAIT
        .byte $53,$20,$59,$4F,$55,$20,$49,$4E,$20,$54,$48,$45,$20,$50,$41,$4C; 47F0  S YOU IN THE PAL
        .byte $41,$43,$45,$FF,$54,$48,$45,$20,$43,$48,$41,$4D,$42,$45,$52,$20; 4800  ACE.THE CHAMBER 
        .byte $4C,$49,$45,$53,$20,$42,$45,$59,$4F,$4E,$44,$20,$54,$48,$45,$53; 4810  LIES BEYOND THES
        .byte $45,$20,$47,$41,$54,$45,$53,$FF,$50,$45,$41,$43,$45,$20,$41,$4E; 4820  E GATES.PEACE AN
        .byte $44,$20,$4A,$4F,$59,$20,$54,$4F,$20,$59,$4F,$55,$2C,$20,$51,$55; 4830  D JOY TO YOU, QU
        .byte $45,$53,$54,$45,$52,$FF,$47,$52,$45,$45,$54,$49,$4E,$47,$53,$20; 4840  ESTER.GREETINGS 
        .byte $51,$55,$45,$53,$54,$45,$52,$FF,$47,$52,$45,$45,$54,$49,$4E,$47; 4850  QUESTER.GREETING
        .byte $53,$21,$FF,$50,$45,$41,$43,$45,$20,$41,$4E,$44,$20,$4A,$4F,$59; 4860  S!.PEACE AND JOY
        .byte $20,$54,$4F,$20,$41,$4C,$4C,$20,$4B,$49,$4E,$44,$41,$52,$FF,$50; 4870   TO ALL KINDAR.P
        .byte $45,$41,$43,$45,$20,$41,$4E,$44,$20,$4A,$4F,$59,$20,$54,$4F,$20; 4880  EACE AND JOY TO 
        .byte $41,$4C,$4C,$20,$51,$55,$45,$53,$54,$45,$52,$53,$FF,$52,$41,$41; 4890  ALL QUESTERS.RAA
        .byte $4D,$4F,$27,$53,$20,$4D,$4F,$54,$48,$45,$52,$3A,$20,$53,$45,$45; 48A0  MO'S MOTHER: SEE
        .byte $4B,$20,$54,$48,$45,$20,$53,$50,$49,$52,$49,$54,$FF,$45,$4E,$54; 48B0  K THE SPIRIT.ENT
        .byte $45,$52,$20,$51,$55,$45,$53,$54,$45,$52,$FF,$57,$45,$4C,$43,$4F; 48C0  ER QUESTER.WELCO
        .byte $4D,$45,$20,$54,$4F,$20,$4D,$59,$20,$48,$55,$4D,$42,$4C,$45,$20; 48D0  ME TO MY HUMBLE 
        .byte $41,$42,$4F,$44,$45,$FF,$49,$20,$48,$41,$56,$45,$20,$4E,$4F,$54; 48E0  ABODE.I HAVE NOT
        .byte $48,$49,$4E,$47,$20,$54,$4F,$20,$4F,$46,$46,$45,$52,$20,$59,$4F; 48F0  HING TO OFFER YO
        .byte $55,$FF,$41,$52,$45,$20,$54,$48,$45,$52,$45,$20,$4E,$4F,$20,$45; 4900  U.ARE THERE NO E
        .byte $52,$44,$4C,$49,$4E,$47,$20,$51,$55,$45,$53,$54,$45,$52,$53,$3F; 4910  RDLING QUESTERS?
        .byte $FF,$49,$20,$48,$41,$56,$45,$20,$4E,$4F,$54,$48,$49,$4E,$47,$20; 4920  .I HAVE NOTHING 
        .byte $54,$4F,$20,$47,$49,$56,$45,$FF,$59,$4F,$55,$20,$48,$41,$56,$45; 4930  TO GIVE.YOU HAVE
        .byte $20,$4D,$59,$20,$42,$4C,$45,$53,$53,$49,$4E,$47,$FF,$57,$45,$20; 4940   MY BLESSING.WE 
        .byte $57,$4F,$55,$4C,$44,$20,$4E,$45,$45,$44,$20,$4E,$4F,$20,$51,$55; 4950  WOULD NEED NO QU
        .byte $45,$53,$54,$20,$49,$46,$20,$50,$45,$4F,$50,$4C,$45,$FF,$53,$54; 4960  EST IF PEOPLE.ST
        .byte $41,$59,$45,$44,$20,$57,$48,$45,$52,$45,$20,$54,$48,$45,$59,$20; 4970  AYED WHERE THEY 
        .byte $42,$45,$4C,$4F,$4E,$47,$FF,$54,$48,$45,$52,$45,$20,$4D,$55,$53; 4980  BELONG.THERE MUS
        .byte $54,$20,$42,$45,$20,$53,$4F,$4D,$45,$20,$4D,$49,$53,$54,$41,$4B; 4990  T BE SOME MISTAK
        .byte $45,$FF,$54,$48,$49,$53,$20,$49,$53,$20,$41,$20,$4B,$49,$4E,$44; 49A0  E.THIS IS A KIND
        .byte $41,$52,$20,$48,$4F,$4D,$45,$FF,$49,$20,$47,$41,$56,$45,$20,$41; 49B0  AR HOME.I GAVE A
        .byte $54,$20,$54,$48,$45,$20,$54,$45,$4D,$50,$4C,$45,$FF,$49,$20,$48; 49C0  T THE TEMPLE.I H
        .byte $41,$56,$45,$20,$4E,$4F,$20,$54,$4F,$4B,$45,$4E,$53,$20,$46,$4F; 49D0  AVE NO TOKENS FO
        .byte $52,$20,$4B,$49,$4E,$44,$41,$52,$FF,$53,$4F,$52,$52,$59,$2C,$20; 49E0  R KINDAR.SORRY, 
        .byte $57,$45,$20,$48,$41,$56,$45,$20,$4A,$55,$53,$54,$20,$45,$41,$54; 49F0  WE HAVE JUST EAT
        .byte $45,$4E,$FF,$53,$45,$45,$4B,$20,$54,$48,$45,$20,$46,$4F,$52,$47; 4A00  EN.SEEK THE FORG
        .byte $4F,$54,$54,$45,$4E,$20,$43,$48,$41,$4D,$42,$45,$52,$20,$4F,$4E; 4A10  OTTEN CHAMBER ON
        .byte $20,$54,$45,$4D,$50,$4C,$45,$FF,$4C,$41,$4D,$50,$2E,$20,$49,$54; 4A20   TEMPLE.LAMP. IT
        .byte $20,$53,$48,$49,$4E,$45,$53,$20,$57,$49,$54,$48,$4F,$55,$54,$20; 4A30   SHINES WITHOUT 
        .byte $45,$4E,$44,$FF,$53,$45,$45,$4B,$20,$48,$49,$47,$48,$20,$41,$4E; 4A40  END.SEEK HIGH AN
        .byte $44,$20,$4C,$4F,$57,$FF,$59,$4F,$55,$20,$57,$49,$4C,$4C,$20,$48; 4A50  D LOW.YOU WILL H
        .byte $45,$41,$52,$20,$4E,$4F,$54,$48,$49,$4E,$47,$20,$46,$52,$4F,$4D; 4A60  EAR NOTHING FROM
        .byte $20,$4D,$45,$FF,$54,$48,$45,$20,$45,$4C,$49,$58,$45,$52,$20,$57; 4A70   ME.THE ELIXER W
        .byte $49,$4C,$4C,$20,$53,$54,$52,$45,$4E,$47,$54,$48,$45,$4E,$20,$59; 4A80  ILL STRENGTHEN Y
        .byte $4F,$55,$FF,$49,$20,$44,$4F,$4E,$27,$54,$20,$54,$52,$55,$53,$54; 4A90  OU.I DON'T TRUST
        .byte $20,$4B,$49,$4E,$44,$41,$52,$FF,$52,$4F,$50,$45,$53,$20,$57,$49; 4AA0   KINDAR.ROPES WI
        .byte $4C,$4C,$20,$54,$41,$4B,$45,$20,$59,$4F,$55,$20,$54,$4F,$20,$53; 4AB0  LL TAKE YOU TO S
        .byte $4B,$59,$20,$47,$52,$55,$4E,$44,$20,$54,$4F,$50,$FF,$42,$45,$20; 4AC0  KY GRUND TOP.BE 
        .byte $4F,$46,$46,$2C,$20,$4B,$49,$4E,$44,$41,$52,$FF,$54,$48,$45,$20; 4AD0  OFF, KINDAR.THE 
        .byte $51,$55,$45,$53,$54,$20,$49,$53,$20,$48,$4F,$50,$45,$4C,$45,$53; 4AE0  QUEST IS HOPELES
        .byte $53,$FF,$54,$48,$45,$20,$4F,$4C,$44,$20,$57,$41,$59,$53,$20,$57; 4AF0  S.THE OLD WAYS W
        .byte $45,$52,$45,$20,$42,$45,$54,$54,$45,$52,$FF,$4D,$59,$20,$4E,$45; 4B00  ERE BETTER.MY NE
        .byte $49,$47,$48,$42,$4F,$52,$53,$20,$41,$52,$45,$20,$55,$4E,$54,$52; 4B10  IGHBORS ARE UNTR
        .byte $55,$53,$54,$57,$4F,$52,$54,$48,$59,$FF,$47,$4F,$20,$41,$57,$41; 4B20  USTWORTHY.GO AWA
        .byte $59,$FF,$53,$4C,$45,$45,$50,$20,$57,$45,$4C,$4C,$2C,$20,$46,$4F; 4B30  Y.SLEEP WELL, FO
        .byte $4F,$4C,$FF,$46,$49,$4E,$44,$20,$54,$48,$45,$20,$57,$49,$53,$45; 4B40  OL.FIND THE WISE
        .byte $20,$43,$48,$49,$4C,$44,$20,$4F,$46,$20,$54,$48,$45,$20,$47,$41; 4B50   CHILD OF THE GA
        .byte $52,$44,$45,$4E,$FF,$4D,$41,$59,$20,$4E,$45,$53,$48,$4F,$4D,$20; 4B60  RDEN.MAY NESHOM 
        .byte $42,$4C,$45,$53,$53,$20,$59,$4F,$55,$FF,$49,$20,$48,$41,$56,$45; 4B70  BLESS YOU.I HAVE
        .byte $20,$4E,$4F,$20,$46,$41,$49,$54,$48,$20,$49,$4E,$20,$59,$4F,$55; 4B80   NO FAITH IN YOU
        .byte $52,$20,$51,$55,$45,$53,$54,$FF,$59,$4F,$55,$20,$57,$49,$4C,$4C; 4B90  R QUEST.YOU WILL
        .byte $20,$47,$45,$54,$20,$4E,$4F,$20,$48,$45,$4C,$50,$20,$46,$52,$4F; 4BA0   GET NO HELP FRO
        .byte $4D,$20,$4D,$45,$FF,$44,$27,$4F,$4C,$20,$53,$4F,$4C,$41,$41,$54; 4BB0  M ME.D'OL SOLAAT
        .byte $27,$53,$20,$4D,$45,$4E,$20,$41,$52,$45,$20,$57,$41,$49,$54,$49; 4BC0  'S MEN ARE WAITI
        .byte $4E,$47,$FF,$42,$45,$57,$41,$52,$45,$20,$4F,$46,$20,$4D,$59,$20; 4BD0  NG.BEWARE OF MY 
        .byte $4E,$45,$49,$47,$48,$42,$4F,$52,$53,$FF,$42,$45,$57,$41,$52,$45; 4BE0  NEIGHBORS.BEWARE
        .byte $20,$4F,$46,$20,$53,$4E,$41,$4B,$45,$53,$FF,$43,$41,$4E,$20,$41; 4BF0   OF SNAKES.CAN A
        .byte $4E,$20,$45,$52,$44,$4C,$49,$4E,$47,$20,$42,$45,$20,$54,$52,$55; 4C00  N ERDLING BE TRU
        .byte $53,$54,$45,$44,$3F,$FF,$44,$4F,$4E,$27,$54,$20,$57,$4F,$52,$52; 4C10  STED?.DON'T WORR
        .byte $59,$2E,$20,$20,$48,$41,$56,$45,$20,$41,$20,$42,$45,$52,$52,$59; 4C20  Y.  HAVE A BERRY
        .byte $FF,$49,$20,$4E,$45,$45,$44,$20,$41,$20,$53,$48,$55,$42,$41,$FF; 4C30  .I NEED A SHUBA.
        .byte $54,$48,$45,$20,$48,$45,$52,$4D,$49,$54,$20,$42,$45,$53,$54,$4F; 4C40  THE HERMIT BESTO
        .byte $57,$53,$20,$53,$50,$49,$52,$49,$54,$FF,$53,$45,$45,$4B,$45,$52; 4C50  WS SPIRIT.SEEKER
        .byte $53,$20,$4E,$45,$45,$44,$20,$41,$20,$48,$4F,$4E,$45,$59,$20,$4C; 4C60  S NEED A HONEY L
        .byte $41,$4D,$50,$FF,$54,$48,$45,$20,$4E,$45,$4B,$4F,$4D,$20,$57,$49; 4C70  AMP.THE NEKOM WI
        .byte $4C,$4C,$20,$52,$45,$57,$41,$52,$44,$20,$4D,$45,$FF,$41,$20,$54; 4C80  LL REWARD ME.A T
        .byte $4F,$4B,$45,$4E,$20,$42,$55,$59,$53,$20,$45,$4E,$54,$52,$59,$FF; 4C90  OKEN BUYS ENTRY.
        .byte $4D,$49,$4E,$44,$20,$42,$4C,$4F,$43,$4B,$49,$4E,$47,$FF,$4C,$45; 4CA0  MIND BLOCKING.LE
        .byte $54,$20,$59,$4F,$55,$52,$20,$4F,$57,$4E,$20,$4B,$49,$4E,$44,$20; 4CB0  T YOUR OWN KIND 
        .byte $46,$45,$45,$44,$20,$59,$4F,$55,$FF,$44,$52,$45,$41,$4D,$20,$49; 4CC0  FEED YOU.DREAM I
        .byte $4E,$20,$54,$48,$45,$20,$53,$4B,$59,$FF,$53,$45,$45,$4B,$20,$45; 4CD0  N THE SKY.SEEK E
        .byte $4C,$53,$45,$57,$48,$45,$52,$45,$FF,$56,$49,$53,$49,$54,$20,$54; 4CE0  LSEWHERE.VISIT T
        .byte $48,$45,$20,$54,$45,$4D,$50,$4C,$45,$20,$47,$52,$55,$4E,$44,$53; 4CF0  HE TEMPLE GRUNDS
        .byte $FF,$54,$4F,$4B,$45,$4E,$53,$20,$41,$52,$45,$20,$45,$52,$44,$4C; 4D00  .TOKENS ARE ERDL
        .byte $49,$4E,$47,$20,$43,$4F,$49,$4E,$FF,$54,$48,$45,$20,$47,$55,$41; 4D10  ING COIN.THE GUA
        .byte $52,$44,$20,$45,$41,$54,$53,$20,$54,$4F,$4F,$20,$4D,$41,$4E,$59; 4D20  RD EATS TOO MANY
        .byte $20,$42,$45,$52,$52,$49,$45,$53,$FF,$54,$48,$45,$20,$4E,$45,$4B; 4D30   BERRIES.THE NEK
        .byte $4F,$4D,$20,$57,$49,$4C,$4C,$20,$50,$41,$59,$20,$4D,$45,$20,$57; 4D40  OM WILL PAY ME W
        .byte $45,$4C,$4C,$FF,$4C,$4F,$4F,$4B,$20,$42,$45,$4C,$4F,$57,$FF,$54; 4D50  ELL.LOOK BELOW.T
        .byte $48,$45,$20,$48,$45,$52,$4D,$49,$54,$3A,$20,$45,$41,$52,$4E,$20; 4D60  HE HERMIT: EARN 
        .byte $44,$27,$4F,$4C,$20,$4E,$45,$53,$48,$4F,$4D,$27,$53,$20,$42,$4C; 4D70  D'OL NESHOM'S BL
        .byte $45,$53,$53,$49,$4E,$47,$FF,$53,$45,$45,$4B,$20,$41,$20,$53,$4B; 4D80  ESSING.SEEK A SK
        .byte $59,$2D,$4E,$49,$44,$20,$41,$4E,$44,$20,$41,$20,$44,$52,$45,$41; 4D90  Y-NID AND A DREA
        .byte $4D,$FF,$44,$27,$4F,$4C,$20,$4E,$45,$53,$48,$4F,$4D,$3A,$20,$4D; 4DA0  M.D'OL NESHOM: M
        .byte $59,$20,$42,$4C,$45,$53,$53,$49,$4E,$47,$20,$51,$55,$45,$53,$54; 4DB0  Y BLESSING QUEST
        .byte $45,$52,$FF,$49,$20,$47,$52,$41,$4E,$54,$20,$59,$4F,$55,$20,$54; 4DC0  ER.I GRANT YOU T
        .byte $48,$45,$20,$53,$50,$49,$52,$49,$54,$20,$42,$45,$4C,$4C,$FF,$59; 4DD0  HE SPIRIT BELL.Y
        .byte $4F,$55,$20,$43,$41,$4E,$20,$52,$41,$49,$53,$45,$20,$54,$48,$45; 4DE0  OU CAN RAISE THE
        .byte $20,$46,$41,$4C,$4C,$45,$4E,$20,$53,$50,$49,$52,$49,$54,$20,$4C; 4DF0   FALLEN SPIRIT L
        .byte $45,$41,$44,$45,$52,$FF,$56,$41,$54,$41,$52,$3A,$20,$4D,$41,$59; 4E00  EADER.VATAR: MAY
        .byte $20,$54,$48,$45,$20,$53,$50,$49,$52,$49,$54,$20,$53,$55,$53,$54; 4E10   THE SPIRIT SUST
        .byte $41,$49,$4E,$20,$59,$4F,$55,$FF,$4F,$4E,$4C,$59,$20,$54,$48,$45; 4E20  AIN YOU.ONLY THE
        .byte $20,$53,$50,$49,$52,$49,$54,$20,$42,$45,$4C,$4C,$20,$43,$41,$4E; 4E30   SPIRIT BELL CAN
        .byte $20,$47,$55,$49,$44,$45,$20,$59,$4F,$55,$FF,$57,$41,$4E,$54,$20; 4E40   GUIDE YOU.WANT 
        .byte $54,$4F,$20,$50,$4C,$41,$59,$3F,$FF,$48,$45,$4C,$4C,$4F,$2C,$20; 4E50  TO PLAY?.HELLO, 
        .byte $51,$55,$45,$53,$54,$45,$52,$FF,$49,$20,$4C,$4F,$53,$54,$20,$4D; 4E60  QUESTER.I LOST M
        .byte $59,$20,$54,$4F,$4B,$45,$4E,$FF,$49,$20,$48,$41,$44,$20,$50,$41; 4E70  Y TOKEN.I HAD PA
        .byte $4E,$20,$46,$4F,$52,$20,$4C,$55,$4E,$43,$48,$FF,$46,$49,$4E,$44; 4E80  N FOR LUNCH.FIND
        .byte $20,$54,$48,$45,$20,$57,$49,$53,$45,$20,$4F,$4E,$45,$FF,$52,$41; 4E90   THE WISE ONE.RA
        .byte $41,$4D,$4F,$27,$53,$20,$4D,$4F,$54,$48,$45,$52,$20,$43,$41,$4E; 4EA0  AMO'S MOTHER CAN
        .byte $20,$48,$45,$4C,$50,$20,$59,$4F,$55,$FF,$44,$27,$46,$41,$4C,$4C; 4EB0   HELP YOU.D'FALL
        .byte $41,$20,$41,$57,$41,$49,$54,$53,$20,$59,$4F,$55,$FF,$44,$27,$4F; 4EC0  A AWAITS YOU.D'O
        .byte $4C,$20,$46,$41,$4C,$4C,$41,$3A,$20,$53,$45,$45,$4B,$20,$54,$48; 4ED0  L FALLA: SEEK TH
        .byte $45,$20,$46,$4F,$52,$47,$4F,$54,$54,$45,$4E,$20,$4B,$45,$59,$FF; 4EE0  E FORGOTTEN KEY.
        .byte $49,$54,$20,$4E,$4F,$57,$20,$42,$45,$4C,$4F,$4E,$47,$53,$20,$54; 4EF0  IT NOW BELONGS T
        .byte $4F,$20,$59,$4F,$55,$FF,$54,$48,$45,$20,$46,$4F,$52,$47,$4F,$54; 4F00  O YOU.THE FORGOT
        .byte $54,$45,$4E,$20,$43,$48,$41,$4D,$42,$45,$52,$20,$49,$53,$20,$4E; 4F10  TEN CHAMBER IS N
        .byte $45,$41,$52,$FF,$52,$41,$41,$4D,$4F,$3A,$20,$4D,$41,$59,$20,$54; 4F20  EAR.RAAMO: MAY T
        .byte $48,$45,$20,$53,$50,$49,$52,$49,$54,$20,$42,$4C,$45,$53,$53,$20; 4F30  HE SPIRIT BLESS 
        .byte $59,$4F,$55,$FF,$49,$20,$4E,$45,$45,$44,$20,$41,$20,$52,$4F,$50; 4F40  YOU.I NEED A ROP
        .byte $45,$20,$4F,$52,$20,$41,$20,$53,$48,$55,$42,$41,$FF,$49,$27,$4D; 4F50  E OR A SHUBA.I'M
        .byte $20,$41,$46,$52,$41,$49,$44,$20,$4F,$46,$20,$46,$41,$4C,$4C,$49; 4F60   AFRAID OF FALLI
        .byte $4E,$47,$FF,$4F,$4E,$4C,$59,$20,$41,$20,$54,$4F,$4B,$45,$4E,$FF; 4F70  NG.ONLY A TOKEN.
        .byte $54,$48,$45,$20,$51,$55,$45,$53,$54,$45,$52,$20,$41,$44,$4D,$49; 4F80  THE QUESTER ADMI
        .byte $52,$45,$53,$20,$4D,$59,$20,$56,$4F,$49,$43,$45,$FF,$52,$41,$49; 4F90  RES MY VOICE.RAI
        .byte $53,$45,$20,$59,$4F,$55,$52,$20,$53,$50,$49,$52,$49,$54,$20,$49; 4FA0  SE YOUR SPIRIT I
        .byte $4E,$20,$54,$48,$45,$20,$47,$41,$52,$44,$45,$4E,$FF,$53,$45,$41; 4FB0  N THE GARDEN.SEA
        .byte $52,$43,$48,$20,$54,$48,$45,$20,$48,$45,$49,$47,$48,$54,$53,$20; 4FC0  RCH THE HEIGHTS 
        .byte $4F,$46,$20,$47,$52,$41,$4E,$44,$20,$47,$52,$55,$4E,$44,$FF,$49; 4FD0  OF GRAND GRUND.I
        .byte $20,$48,$45,$41,$52,$44,$20,$41,$20,$56,$4F,$49,$43,$45,$20,$43; 4FE0   HEARD A VOICE C
        .byte $41,$4C,$4C,$49,$4E,$47,$20,$46,$52,$4F,$4D,$20,$42,$45,$4C,$4F; 4FF0  ALLING FROM BELO
        .byte $57,$FF,$46,$45,$41,$52,$FF,$53,$4F,$4D,$45,$4F,$4E,$45,$20,$4D; 5000  W.FEAR.SOMEONE M
        .byte $55,$53,$54,$20,$42,$45,$20,$4C,$4F,$53,$54,$20,$44,$4F,$57,$4E; 5010  UST BE LOST DOWN
        .byte $20,$54,$48,$45,$52,$45,$FF,$45,$4E,$54,$45,$52,$20,$57,$49,$54; 5020   THERE.ENTER WIT
        .byte $48,$20,$54,$48,$45,$20,$54,$45,$4D,$50,$4C,$45,$20,$4B,$45,$59; 5030  H THE TEMPLE KEY
        .byte $FF,$2A,$FF,$59,$4F,$55,$20,$53,$48,$4F,$55,$4C,$44,$20,$43,$41; 5040  .*.YOU SHOULD CA
        .byte $52,$52,$59,$20,$41,$20,$52,$4F,$50,$45,$20,$41,$4E,$44,$20,$41; 5050  RRY A ROPE AND A
        .byte $20,$42,$45,$41,$4B,$FF,$53,$45,$45,$4B,$20,$54,$48,$45,$20,$48; 5060   BEAK.SEEK THE H
        .byte $45,$52,$4D,$49,$54,$20,$4F,$46,$20,$47,$52,$41,$4E,$44,$20,$47; 5070  ERMIT OF GRAND G
        .byte $52,$55,$4E,$44,$FF,$50,$45,$41,$43,$45,$20,$54,$4F,$20,$59,$4F; 5080  RUND.PEACE TO YO
        .byte $55,$20,$50,$49,$4C,$47,$52,$49,$4D,$FF,$4D,$41,$59,$20,$49,$20; 5090  U PILGRIM.MAY I 
        .byte $53,$45,$45,$20,$59,$4F,$55,$52,$20,$50,$41,$53,$53,$3F,$FF,$49; 50A0  SEE YOUR PASS?.I
        .byte $27,$44,$20,$53,$45,$54,$54,$4C,$45,$20,$46,$4F,$52,$20,$53,$4F; 50B0  'D SETTLE FOR SO
        .byte $4D,$45,$20,$47,$4F,$4F,$44,$20,$42,$45,$52,$52,$59,$FF,$50,$49; 50C0  ME GOOD BERRY.PI
        .byte $54,$59,$FF,$57,$41,$49,$54,$20,$41,$20,$4D,$49,$4E,$55,$54,$45; 50D0  TY.WAIT A MINUTE
        .byte $2E,$20,$20,$49,$20,$57,$41,$4E,$54,$20,$54,$4F,$4B,$45,$4E,$53; 50E0  .  I WANT TOKENS
        .byte $2E,$FF,$49,$20,$48,$4F,$50,$45,$20,$59,$4F,$55,$52,$20,$53,$54; 50F0  ..I HOPE YOUR ST
        .byte $41,$4D,$49,$4E,$41,$20,$49,$53,$20,$48,$49,$47,$48,$FF,$47,$41; 5100  AMINA IS HIGH.GA
        .byte $54,$48,$45,$52,$20,$42,$45,$52,$52,$49,$45,$53,$20,$4F,$4E,$20; 5110  THER BERRIES ON 
        .byte $42,$52,$41,$4E,$43,$48,$20,$45,$4E,$44,$53,$FF,$54,$48,$45,$20; 5120  BRANCH ENDS.THE 
        .byte $53,$50,$49,$52,$49,$54,$20,$46,$41,$44,$45,$53,$2C,$20,$49,$4E; 5130  SPIRIT FADES, IN
        .byte $20,$44,$41,$52,$4B,$4E,$45,$53,$53,$20,$4C,$59,$49,$4E,$47,$FF; 5140   DARKNESS LYING.
        .byte $41,$20,$51,$55,$45,$53,$54,$20,$50,$52,$4F,$43,$4C,$41,$49,$4D; 5150  A QUEST PROCLAIM
        .byte $21,$20,$20,$54,$48,$45,$20,$4C,$49,$47,$48,$54,$20,$49,$53,$20; 5160  !  THE LIGHT IS 
        .byte $44,$59,$49,$4E,$47,$FF,$43,$4C,$49,$4D,$42,$20,$41,$54,$20,$54; 5170  DYING.CLIMB AT T
        .byte $48,$45,$20,$42,$41,$53,$45,$20,$4F,$46,$20,$54,$48,$45,$20,$43; 5180  HE BASE OF THE C
        .byte $45,$4E,$54,$45,$52,$20,$54,$52,$55,$4E,$4B,$FF,$53,$45,$45,$4B; 5190  ENTER TRUNK.SEEK
        .byte $20,$54,$48,$45,$20,$4C,$4F,$53,$54,$20,$4B,$45,$59,$20,$41,$42; 51A0   THE LOST KEY AB
        .byte $4F,$56,$45,$FF,$4D,$59,$20,$53,$4F,$4E,$20,$4C,$49,$56,$45,$53; 51B0  OVE.MY SON LIVES
        .byte $2E,$20,$59,$4F,$55,$20,$4D,$55,$53,$54,$20,$53,$41,$56,$45,$20; 51C0  . YOU MUST SAVE 
        .byte $48,$49,$4D,$FF,$54,$48,$45,$20,$57,$49,$53,$45,$20,$43,$48,$49; 51D0  HIM.THE WISE CHI
        .byte $4C,$44,$3A,$20,$54,$48,$45,$20,$42,$4C,$45,$53,$53,$45,$44,$20; 51E0  LD: THE BLESSED 
        .byte $4F,$4E,$45,$20,$4C,$49,$56,$45,$53,$FF,$54,$48,$45,$20,$53,$50; 51F0  ONE LIVES.THE SP
        .byte $49,$52,$49,$54,$20,$52,$49,$53,$45,$53,$20,$57,$49,$54,$48,$49; 5200  IRIT RISES WITHI
        .byte $4E,$FF,$57,$41,$52,$4D,$54,$48,$FF,$50,$41,$53,$53,$20,$54,$48; 5210  N.WARMTH.PASS TH
        .byte $45,$20,$54,$57,$4F,$20,$47,$41,$54,$45,$53,$20,$4F,$46,$20,$54; 5220  E TWO GATES OF T
        .byte $48,$45,$20,$46,$4F,$52,$47,$4F,$54,$54,$45,$4E,$FF,$44,$27,$4F; 5230  HE FORGOTTEN.D'O
        .byte $4C,$20,$46,$41,$4C,$4C,$41,$27,$53,$20,$4B,$45,$59,$20,$49,$53; 5240  L FALLA'S KEY IS
        .byte $20,$57,$45,$4C,$4C,$20,$48,$49,$44,$44,$45,$4E,$FF,$46,$49,$4E; 5250   WELL HIDDEN.FIN
        .byte $44,$20,$54,$48,$4F,$53,$45,$20,$57,$48,$4F,$20,$57,$49,$4C,$4C; 5260  D THOSE WHO WILL
        .byte $20,$52,$41,$49,$53,$45,$20,$59,$4F,$55,$52,$20,$53,$50,$49,$52; 5270   RAISE YOUR SPIR
        .byte $49,$54,$FF,$50,$45,$4E,$53,$45,$20,$54,$48,$45,$20,$41,$4E,$49; 5280  IT.PENSE THE ANI
        .byte $4D,$41,$4C,$53,$20,$49,$46,$20,$59,$4F,$55,$20,$48,$41,$56,$45; 5290  MALS IF YOU HAVE
        .byte $20,$54,$48,$45,$20,$50,$4F,$57,$45,$52,$FF,$50,$45,$4E,$53,$45; 52A0   THE POWER.PENSE
        .byte $20,$44,$45,$45,$50,$4C,$59,$20,$49,$46,$20,$59,$4F,$55,$20,$46; 52B0   DEEPLY IF YOU F
        .byte $49,$4E,$44,$20,$54,$48,$45,$20,$41,$4E,$49,$4D,$41,$4C,$53,$FF; 52C0  IND THE ANIMALS.
        .byte $54,$48,$45,$20,$48,$45,$52,$4D,$49,$54,$20,$48,$45,$4C,$50,$53; 52D0  THE HERMIT HELPS
        .byte $20,$49,$4E,$20,$4D,$41,$4E,$59,$20,$57,$41,$59,$53,$FF,$54,$48; 52E0   IN MANY WAYS.TH
        .byte $45,$20,$54,$45,$4D,$50,$4C,$45,$20,$4B,$45,$59,$20,$4F,$50,$45; 52F0  E TEMPLE KEY OPE
        .byte $4E,$53,$20,$4D,$41,$4E,$59,$20,$47,$41,$54,$45,$53,$FF,$47,$49; 5300  NS MANY GATES.GI
        .byte $56,$45,$20,$55,$50,$20,$54,$48,$49,$53,$20,$46,$4F,$4F,$4C,$49; 5310  VE UP THIS FOOLI
        .byte $53,$48,$20,$51,$55,$45,$53,$54,$FF,$54,$48,$45,$20,$57,$49,$53; 5320  SH QUEST.THE WIS
        .byte $45,$20,$43,$48,$49,$4C,$44,$20,$4B,$4E,$4F,$57,$53,$20,$4D,$4F; 5330  E CHILD KNOWS MO
        .byte $52,$45,$20,$54,$48,$41,$4E,$20,$49,$20,$44,$4F,$FF,$54,$48,$45; 5340  RE THAN I DO.THE
        .byte $20,$57,$49,$53,$45,$20,$4F,$4E,$45,$20,$4C,$49,$56,$45,$53,$20; 5350   WISE ONE LIVES 
        .byte $4E,$45,$41,$52,$FF,$4C,$45,$41,$52,$4E,$20,$54,$4F,$20,$55,$53; 5360  NEAR.LEARN TO US
        .byte $45,$20,$54,$48,$45,$20,$53,$50,$49,$52,$49,$54,$20,$50,$4F,$57; 5370  E THE SPIRIT POW
        .byte $45,$52,$53,$FF,$50,$45,$52,$48,$41,$50,$53,$20,$54,$48,$45,$20; 5380  ERS.PERHAPS THE 
        .byte $48,$45,$52,$4D,$49,$54,$20,$57,$49,$4C,$4C,$20,$48,$45,$4C,$50; 5390  HERMIT WILL HELP
        .byte $20,$59,$4F,$55,$FF,$50,$45,$4E,$53,$45,$20,$53,$54,$52,$41,$4E; 53A0   YOU.PENSE STRAN
        .byte $47,$45,$52,$53,$20,$46,$52,$4F,$4D,$20,$41,$20,$44,$49,$53,$54; 53B0  GERS FROM A DIST
        .byte $41,$4E,$43,$45,$FF,$57,$45,$4C,$43,$4F,$4D,$45,$20,$51,$55,$45; 53C0  ANCE.WELCOME QUE
        .byte $53,$54,$45,$52,$FF,$44,$4F,$20,$59,$4F,$55,$20,$4E,$45,$45,$44; 53D0  STER.DO YOU NEED
        .byte $20,$41,$4E,$20,$45,$58,$54,$52,$41,$20,$53,$48,$55,$42,$41,$3F; 53E0   AN EXTRA SHUBA?
        .byte $FF,$47,$4C,$49,$44,$45,$20,$46,$52,$4F,$4D,$20,$53,$54,$41,$52; 53F0  .GLIDE FROM STAR
        .byte $20,$54,$4F,$20,$54,$45,$4D,$50,$4C,$45,$FF,$56,$41,$54,$41,$52; 5400   TO TEMPLE.VATAR
        .byte $20,$42,$45,$4C,$49,$45,$56,$45,$53,$20,$49,$4E,$20,$59,$4F,$55; 5410   BELIEVES IN YOU
        .byte $52,$20,$51,$55,$45,$53,$54,$FF,$56,$41,$54,$41,$52,$20,$4C,$49; 5420  R QUEST.VATAR LI
        .byte $56,$45,$53,$20,$42,$45,$4C,$4F,$57,$20,$54,$48,$45,$20,$52,$4F; 5430  VES BELOW THE RO
        .byte $4F,$54,$FF,$2A,$FF,$52,$41,$41,$4D,$4F,$20,$57,$4F,$55,$4C,$44; 5440  OT.*.RAAMO WOULD
        .byte $20,$48,$41,$56,$45,$20,$55,$4E,$49,$54,$45,$44,$20,$4F,$55,$52; 5450   HAVE UNITED OUR
        .byte $20,$50,$45,$4F,$50,$4C,$45,$FF,$41,$54,$20,$4C,$41,$53,$54,$21; 5460   PEOPLE.AT LAST!
        .byte $20,$20,$41,$20,$51,$55,$45,$53,$54,$45,$52,$20,$43,$4F,$4D,$45; 5470    A QUESTER COME
        .byte $53,$FF,$53,$41,$44,$4E,$45,$53,$53,$FF,$49,$27,$56,$45,$20,$42; 5480  S.SADNESS.I'VE B
        .byte $45,$45,$4E,$20,$4F,$56,$45,$52,$20,$54,$48,$45,$20,$54,$45,$4D; 5490  EEN OVER THE TEM
        .byte $50,$4C,$45,$20,$47,$41,$54,$45,$FF,$47,$52,$55,$4E,$44,$53,$50; 54A0  PLE GATE.GRUNDSP
        .byte $52,$45,$4B,$45,$20,$41,$4E,$44,$20,$47,$4C,$49,$44,$45,$20,$4F; 54B0  REKE AND GLIDE O
        .byte $56,$45,$52,$FF,$49,$20,$4C,$4F,$56,$45,$20,$54,$4F,$20,$47,$4C; 54C0  VER.I LOVE TO GL
        .byte $49,$44,$45,$FF,$45,$58,$43,$49,$54,$45,$4D,$45,$4E,$54,$FF,$54; 54D0  IDE.EXCITEMENT.T
        .byte $48,$45,$20,$51,$55,$45,$53,$54,$20,$49,$53,$20,$57,$4F,$56,$45; 54E0  HE QUEST IS WOVE
        .byte $4E,$20,$4C,$49,$4B,$45,$20,$41,$20,$54,$41,$50,$45,$53,$54,$52; 54F0  N LIKE A TAPESTR
        .byte $59,$FF,$53,$45,$45,$4B,$20,$45,$56,$45,$52,$59,$57,$48,$45,$52; 5500  Y.SEEK EVERYWHER
        .byte $45,$FF,$4C,$45,$41,$52,$4E,$20,$54,$48,$45,$20,$53,$50,$49,$52; 5510  E.LEARN THE SPIR
        .byte $49,$54,$20,$53,$4B,$49,$4C,$4C,$53,$FF,$43,$41,$52,$52,$59,$20; 5520  IT SKILLS.CARRY 
        .byte $42,$4F,$54,$48,$20,$53,$50,$49,$52,$49,$54,$20,$54,$4F,$4F,$4C; 5530  BOTH SPIRIT TOOL
        .byte $53,$20,$42,$45,$4C,$4F,$57,$FF,$53,$50,$45,$41,$4B,$20,$57,$49; 5540  S BELOW.SPEAK WI
        .byte $54,$48,$20,$53,$54,$41,$52,$20,$49,$46,$20,$59,$4F,$55,$20,$48; 5550  TH STAR IF YOU H
        .byte $41,$56,$45,$20,$54,$48,$45,$20,$50,$4F,$57,$45,$52,$FF,$47,$4C; 5560  AVE THE POWER.GL
        .byte $49,$44,$45,$20,$46,$52,$4F,$4D,$20,$41,$42,$4F,$56,$45,$FF,$54; 5570  IDE FROM ABOVE.T
        .byte $48,$45,$20,$54,$45,$4D,$50,$4C,$45,$20,$4B,$45,$59,$20,$4F,$50; 5580  HE TEMPLE KEY OP
        .byte $45,$4E,$53,$20,$54,$48,$45,$20,$47,$41,$54,$45,$53,$FF,$54,$48; 5590  ENS THE GATES.TH
        .byte $45,$20,$4B,$45,$59,$20,$49,$53,$20,$4C,$4F,$53,$54,$FF,$54,$48; 55A0  E KEY IS LOST.TH
        .byte $45,$20,$4D,$4F,$54,$48,$45,$52,$20,$4D,$4F,$55,$52,$4E,$53,$20; 55B0  E MOTHER MOURNS 
        .byte $48,$45,$52,$20,$53,$4F,$4E,$FF,$00,$00,$00,$00,$00,$00,$00,$00; 55C0  HER SON.........
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 55D0  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 55E0  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 55F0  ................
