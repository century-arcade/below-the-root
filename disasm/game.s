; game  $8000-$B6FF

        .org $8000

jt_disk_write_block:    ; <- 8912
        jmp disk_write_block  ; 8000  4C 3F 80
jt_disk_read_block:    ; <- 8BC8
        jmp disk_read_block   ; 8003* 4C 84 80
jt_zp_swap:    ; <- 39B5 39E6 3AFC 3B25 8424 8499 8826 8832 88D5
        jmp zp_swap           ; 8006* 4C 26 81
print_inline:    ; <- 2C16 2C2C 2C44 2C65 2D0F 2DAF 34A3 34C0 34CB 34E8 3518 3523 3542 3573 357E 359D 35CE 35D9 35F4 3622 362D 3647 3676 3845 38C2 3918 3A38 3A4C 3A60 3A74 3AA4 3B2E 3C50 3C88 3D5F 3DBD 3DE4 3E1D 3E3D 3EAA 3EF8 3F52 3FBB 4083 409E 40C4 40E8 413B 41AF 41D7 420D 4242 4275 42D6 430F 433F 439A 43AE 43D4 43F0 441B 4484 44D2 8324 834B 8388 83AA 84F6 852D 85A1 85D2 863A 86B0 86EA 8E7B 8EA1 8EC9 8F44 9003 902C 909C 90CC 90FD 911B 9156 9173 919C 91E2 9292 92CD 9465 9492 94B2 94CC 94D9 96CE 9E1A 9E3E 9EB9 9F09 9F25 9F44 A614 A652 A67D AAF5 AB5F AC50 AD35 AD96 ADD1 ADF7 AE14 AEEA AF17 AF8D AFB8 B125 B152 B165 B177 B18A B197 B33C B398 B40F B441 B4B9 B4EC B50A B52C B56D B5A2 B65B B686
        jmp print_inline_impl ; 8009* 4C 8B 82
jt_to_decimal:    ; <- 8891 88A3 8B64 9EF5 B1B5
        jmp to_decimal        ; 800C* 4C 3E 81
jt_get_input:    ; <- 3450 3697 3893 38FE 394E 3AD2 3B54 42B5 4456 837F 8783 883C 8A19 8F09 906B 9F63 A083 A3C5 A7B5 A83A AD17 AF4A B115 B490
        jmp get_input         ; 800F* 4C 72 81
jt_delay:    ; <- 3479 3691 388D 38F8 3948 3AC9 3D3A 87B4 88B2 8A76 9EB3 A892 AA38
        jmp delay_xy          ; 8012* 4C B7 81
L8015:    ; <- 848D 9880
        jmp L81C8             ; 8015* 4C C8 81
L8018:    ; <- 8493 98DB
        jmp L81CF             ; 8018* 4C CF 81
L801B:    ; <- 8417 8B59
        jmp L81D6             ; 801B* 4C D6 81
L801E:    ; <- 849C 8B23
        jmp L81DD             ; 801E* 4C DD 81
L8021:    ; <- 8490 8B20
        jmp L81E4             ; 8021* 4C E4 81
L8024:    ; <- 8496 8B5C
        jmp L81EB             ; 8024* 4C EB 81
jt_wait_input:    ; <- 344D 3694 3890 38FB 394B 3ACC 3ACF 3B51 4265 440B 85F5 8659 870A 8994 8A16 8A23 901C 9F6C A7B2 A837 ACEA AD31 AF0A B112 B431
        jmp wait_input        ; 8027* 4C F2 81
L802A:    ; <- 8A08 8B10
        jmp L81FD             ; 802A  4C FD 81
L802D:    ; <- 8451
        jmp L8223             ; 802D* 4C 23 82
jt_memcpy_pages:    ; <- 3976 397F 39F7 3A00 97C1
        jmp memcpy_pages      ; 8030* 4C 60 82
jt_memclr_pages:    ; <- 36CD 842B 8432 8439 9757
        jmp memclr_pages      ; 8033* 4C 79 82
        jmp L82C5             ; 8036  4C C5 82
rnd:    ; <- 3D3D 8F20 90C2 914F 9844 98FD 990D 9A6A 9A7C 9A8A A003
        jmp rnd_impl          ; 8039* 4C D0 82
L803C:    ; <- 3048 3063 91C1
        jmp delay_xy_slow     ; 803C  4C BE 81
disk_write_block:    ; <- 8000
        jsr zp_swap           ; 803F  20 26 81
        jsr disk_open_cmd     ; 8042  20 CE 80
        jsr disk_open_data    ; 8045  20 DF 80
        ldx #$05              ; 8048  A2 05
        jsr CHKOUT            ; 804A  20 C9 FF
        ldy #$00              ; 804D  A0 00
L804F:    ; <- 8056
        lda blk_buf,y         ; 804F  B9 00 09
        jsr CHROUT            ; 8052  20 D2 FF
        iny                   ; 8055  C8
        bne L804F             ; 8056  D0 F7
        jsr CLRCHN            ; 8058  20 CC FF
        lda #$32              ; 805B  A9 32
        sta D80EE             ; 805D  8D EE 80
        jsr disk_fmt_ts       ; 8060  20 FB 80
        ldx #$0F              ; 8063  A2 0F
        jsr CHKOUT            ; 8065  20 C9 FF
        ldy #$00              ; 8068  A0 00
L806A:    ; <- 8073
        lda disk_cmd_str,y    ; 806A  B9 ED 80
        beq L8075             ; 806D  F0 06
        jsr CHROUT            ; 806F  20 D2 FF
        iny                   ; 8072  C8
        bne L806A             ; 8073  D0 F5
L8075:    ; <- 806D
        jsr CLRCHN            ; 8075  20 CC FF
        lda #$0F              ; 8078  A9 0F
        jsr CLOSE             ; 807A  20 C3 FF
        jsr CLALL             ; 807D  20 E7 FF
        jsr zp_swap           ; 8080  20 26 81
        rts                   ; 8083  60
disk_read_block:    ; <- 8003
        jsr zp_swap           ; 8084* 20 26 81
        jsr disk_open_cmd     ; 8087* 20 CE 80
        jsr disk_open_data    ; 808A* 20 DF 80
        lda #$31              ; 808D* A9 31
        sta D80EE             ; 808F* 8D EE 80
        jsr disk_fmt_ts       ; 8092* 20 FB 80
        ldx #$0F              ; 8095* A2 0F
        jsr CHKOUT            ; 8097* 20 C9 FF
        ldy #$00              ; 809A* A0 00
L809C:    ; <- 80A5
        lda disk_cmd_str,y    ; 809C* B9 ED 80
        beq L80A7             ; 809F* F0 06
        jsr CHROUT            ; 80A1* 20 D2 FF
        iny                   ; 80A4* C8
        bne L809C             ; 80A5* D0 F5
L80A7:    ; <- 809F
        jsr CLRCHN            ; 80A7* 20 CC FF
        ldx #$05              ; 80AA* A2 05
        jsr CHKIN             ; 80AC* 20 C6 FF
        jsr CHRIN             ; 80AF* 20 CF FF
        ldy #$00              ; 80B2* A0 00
L80B4:    ; <- 80BD
        jsr CHRIN             ; 80B4* 20 CF FF
        sta blk_buf,y         ; 80B7* 99 00 09
        iny                   ; 80BA* C8
        cpy #$FF              ; 80BB* C0 FF
        bne L80B4             ; 80BD* D0 F5
        jsr CLRCHN            ; 80BF* 20 CC FF
        lda #$0F              ; 80C2* A9 0F
        jsr CLOSE             ; 80C4* 20 C3 FF
        jsr CLALL             ; 80C7* 20 E7 FF
        jsr zp_swap           ; 80CA* 20 26 81
        rts                   ; 80CD* 60
disk_open_cmd:    ; <- 8042 8087
        lda #$00              ; 80CE* A9 00
        jsr SETNAM            ; 80D0* 20 BD FF
        lda #$0F              ; 80D3* A9 0F
L80D5:    ; <- 80EA
        ldx #$08              ; 80D5* A2 08
        tay                   ; 80D7* A8
        jsr SETLFS            ; 80D8* 20 BA FF
        jsr OPEN              ; 80DB* 20 C0 FF
        rts                   ; 80DE* 60
disk_open_data:    ; <- 8045 808A
        lda #$01              ; 80DF* A9 01
        ldx #$EC              ; 80E1* A2 EC
        ldy #$80              ; 80E3* A0 80
        jsr SETNAM            ; 80E5* 20 BD FF
        lda #$05              ; 80E8* A9 05
        bne L80D5             ; 80EA* D0 E9
        .byte $23                                     ; 80EC  #
disk_cmd_str:    ; <- 806A 809C
        .byte $55                                     ; 80ED  U
D80EE:    ; <- 805D 808F
        .byte $31,$3A,$35,$20,$30,$20                 ; 80EE  1:5 0 
D80F4:    ; <- 810A
        .byte $31                                     ; 80F4  1
D80F5:    ; <- 810D
        .byte $30,$20                                 ; 80F5  0 
D80F7:    ; <- 811F
        .byte $31                                     ; 80F7  1
D80F8:    ; <- 8122
        .byte $33,$0D,$00                             ; 80F8  3..
disk_fmt_ts:    ; <- 8060 8092
        lda blk_track         ; 80FB* AD 00 0A
        ldy #$30              ; 80FE* A0 30
L8100:    ; <- 8106
        sec                   ; 8100* 38
        sbc #$0A              ; 8101* E9 0A
        bmi L8108             ; 8103* 30 03
        iny                   ; 8105* C8
        bne L8100             ; 8106* D0 F8
L8108:    ; <- 8103
        adc #$3A              ; 8108* 69 3A
        sty D80F4             ; 810A* 8C F4 80
        sta D80F5             ; 810D* 8D F5 80
        lda blk_sector        ; 8110* AD 01 0A
        ldy #$30              ; 8113* A0 30
L8115:    ; <- 811B
        sec                   ; 8115* 38
        sbc #$0A              ; 8116* E9 0A
        bmi L811D             ; 8118* 30 03
        iny                   ; 811A* C8
        bne L8115             ; 811B* D0 F8
L811D:    ; <- 8118
        adc #$3A              ; 811D* 69 3A
        sty D80F7             ; 811F* 8C F7 80
        sta D80F8             ; 8122* 8D F8 80
        rts                   ; 8125* 60
zp_swap:    ; <- 8006 803F 8080 8084 80CA
        pha                   ; 8126* 48
        txa                   ; 8127* 8A
        pha                   ; 8128* 48
        ldx #$7F              ; 8129* A2 7F
L812B:    ; <- 8138
        lda $80,x             ; 812B* B5 80
        pha                   ; 812D* 48
        lda zp_shadow,x       ; 812E* BD 80 08
        sta $80,x             ; 8131* 95 80
        pla                   ; 8133* 68
        sta zp_shadow,x       ; 8134* 9D 80 08
        dex                   ; 8137* CA
        bpl L812B             ; 8138* 10 F1
        pla                   ; 813A* 68
        tax                   ; 813B* AA
        pla                   ; 813C* 68
        rts                   ; 813D* 60
; 16-bit X/Y -> five ASCII digits in $92-$96
to_decimal:    ; <- 800C
        stx $90               ; 813E* 86 90
        sty $91               ; 8140* 84 91
        lda #$30              ; 8142* A9 30
        ldx #$06              ; 8144* A2 06
L8146:    ; <- 8149
        sta $91,x             ; 8146* 95 91
        dex                   ; 8148* CA
        bne L8146             ; 8149* D0 FB
L814B:    ; <- 815C 8165
        sec                   ; 814B* 38
        lda $90               ; 814C* A5 90
        sbc dec_pow10_lo,x    ; 814E* FD 68 81
        tay                   ; 8151* A8
        lda $91               ; 8152* A5 91
        sbc dec_pow10_hi,x    ; 8154* FD 6D 81
        bpl L815F             ; 8157* 10 06
        inx                   ; 8159* E8
        cpx #$05              ; 815A* E0 05
        bne L814B             ; 815C* D0 ED
        rts                   ; 815E* 60
L815F:    ; <- 8157
        inc $92,x             ; 815F* F6 92
        sta $91               ; 8161* 85 91
        sty $90               ; 8163* 84 90
        jmp L814B             ; 8165* 4C 4B 81
dec_pow10_lo:    ; <- 814E
        .byte $10,$E8,$64,$0A,$01                     ; 8168  ..d..
dec_pow10_hi:    ; <- 8154
        .byte $27,$03,$00,$00,$00                     ; 816D  '....
; returns A=1 iff fire is held -- that is what selects $A07E over $A0E7
get_input:    ; <- 800F 81F2
        lda #$00              ; 8172* A9 00
        sta in_dx             ; 8174* 85 98
        sta in_dy             ; 8176* 85 99
        sta in_ndirs          ; 8178* 85 9A
        lda demo_flag         ; 817A* AD 92 0A
        beq read_joystick     ; 817D* F0 06
        jsr demo_input        ; 817F* 20 00 30
        jmp L8188             ; 8182* 4C 88 81
read_joystick:    ; <- 817D
        lda CIA1_PRA          ; 8185* AD 00 DC
L8188:    ; <- 8182
        bit joy_right         ; 8188* 2C A3 0A
        bne L8191             ; 818B* D0 04
        inc in_dx             ; 818D* E6 98
        inc in_ndirs          ; 818F* E6 9A
L8191:    ; <- 818B
        bit joy_left          ; 8191* 2C A2 0A
        bne L819A             ; 8194* D0 04
        dec in_dx             ; 8196* C6 98
        inc in_ndirs          ; 8198* E6 9A
L819A:    ; <- 8194
        bit joy_down          ; 819A* 2C A1 0A
        bne L81A3             ; 819D* D0 04
        inc in_dy             ; 819F* E6 99
        inc in_ndirs          ; 81A1* E6 9A
L81A3:    ; <- 819D
        bit joy_up            ; 81A3* 2C A0 0A
        bne L81AC             ; 81A6* D0 04
        dec in_dy             ; 81A8* C6 99
        inc in_ndirs          ; 81AA* E6 9A
L81AC:    ; <- 81A6
        bit joy_fire          ; 81AC* 2C A4 0A
        bne L81B4             ; 81AF* D0 03
        lda #$01              ; 81B1* A9 01
        rts                   ; 81B3* 60
L81B4:    ; <- 81AF
        lda #$00              ; 81B4* A9 00
        rts                   ; 81B6* 60
delay_xy:    ; <- 8012 81B8 81BB 81F9
        dey                   ; 81B7* 88
        bne delay_xy          ; 81B8* D0 FD
        dex                   ; 81BA* CA
        bne delay_xy          ; 81BB* D0 FA
        rts                   ; 81BD* 60
delay_xy_slow:    ; <- 803C 81BF 81C5
        dey                   ; 81BE  88
        bne delay_xy_slow     ; 81BF  D0 FD
L81C1:    ; <- 81C2
        dey                   ; 81C1  88
        bne L81C1             ; 81C2  D0 FD
        dex                   ; 81C4  CA
        bne delay_xy_slow     ; 81C5  D0 F7
        rts                   ; 81C7  60
L81C8:    ; <- 8015
        lda $01               ; 81C8* A5 01
        and #$FD              ; 81CA* 29 FD
        sta $01               ; 81CC* 85 01
        rts                   ; 81CE* 60
L81CF:    ; <- 8018
        lda $01               ; 81CF* A5 01
        ora #$02              ; 81D1* 09 02
        sta $01               ; 81D3* 85 01
        rts                   ; 81D5* 60
L81D6:    ; <- 801B
        lda $01               ; 81D6* A5 01
        and #$FE              ; 81D8* 29 FE
        sta $01               ; 81DA* 85 01
        rts                   ; 81DC* 60
L81DD:    ; <- 801E
        lda $01               ; 81DD* A5 01
        ora #$01              ; 81DF* 09 01
        sta $01               ; 81E1* 85 01
        rts                   ; 81E3* 60
L81E4:    ; <- 8021
        lda $01               ; 81E4* A5 01
        and #$FB              ; 81E6* 29 FB
        sta $01               ; 81E8* 85 01
        rts                   ; 81EA* 60
L81EB:    ; <- 8024
        lda $01               ; 81EB* A5 01
        ora #$04              ; 81ED* 09 04
        sta $01               ; 81EF* 85 01
        rts                   ; 81F1* 60
wait_input:    ; <- 8027 81F5
        jsr get_input         ; 81F2* 20 72 81
        bne wait_input        ; 81F5* D0 FB
        ldx #$40              ; 81F7* A2 40
        jsr delay_xy          ; 81F9* 20 B7 81
        rts                   ; 81FC* 60
L81FD:    ; <- 802A
        pha                   ; 81FD  48
        lda row_addr_lo,y     ; 81FE  B9 00 0B
        sta $80               ; 8201  85 80
        lda row_addr_hi,y     ; 8203  B9 20 0B
        sta $81               ; 8206  85 81
        txa                   ; 8208  8A
        clc                   ; 8209  18
        adc $80               ; 820A  65 80
        sta $80               ; 820C  85 80
        bcc L8212             ; 820E  90 02
        inc $81               ; 8210  E6 81
L8212:    ; <- 820E
        ldy #$00              ; 8212  A0 00
        pla                   ; 8214  68
        sta ($80),y           ; 8215  91 80
        clc                   ; 8217  18
        lda $81               ; 8218  A5 81
        adc #$18              ; 821A  69 18
        sta $81               ; 821C  85 81
        lda $9B               ; 821E  A5 9B
        sta ($80),y           ; 8220  91 80
        rts                   ; 8222  60
L8223:    ; <- 802D
        ldx #$00              ; 8223* A2 00
        lda #$00              ; 8225* A9 00
        sta $80               ; 8227* 85 80
        lda #$C0              ; 8229* A9 C0
        sta $81               ; 822B* 85 81
L822D:    ; <- 8243
        lda $81               ; 822D* A5 81
        sta row_addr_hi,x     ; 822F* 9D 20 0B
        lda $80               ; 8232* A5 80
        sta row_addr_lo,x     ; 8234* 9D 00 0B
        clc                   ; 8237* 18
        adc #$28              ; 8238* 69 28
        sta $80               ; 823A* 85 80
        bcc L8240             ; 823C* 90 02
        inc $81               ; 823E* E6 81
L8240:    ; <- 823C
        inx                   ; 8240* E8
        cpx #$19              ; 8241* E0 19
        bne L822D             ; 8243* D0 E8
        ldx #$18              ; 8245* A2 18
        lda #$F0              ; 8247* A9 F0
L8249:    ; <- 8250
        sta row_to_y,x        ; 8249* 9D 70 0B
        sec                   ; 824C* 38
        sbc #$08              ; 824D* E9 08
        dex                   ; 824F* CA
        bpl L8249             ; 8250* 10 F7
        ldx #$27              ; 8252* A2 27
        lda #$48              ; 8254* A9 48
L8256:    ; <- 825D
        sta col_to_x,x        ; 8256* 9D 40 0B
        sec                   ; 8259* 38
        sbc #$08              ; 825A* E9 08
        dex                   ; 825C* CA
        bpl L8256             ; 825D* 10 F7
        rts                   ; 825F* 60
memcpy_pages:    ; <- 8030
        sta $81               ; 8260* 85 81
        sty $83               ; 8262* 84 83
        ldy #$00              ; 8264* A0 00
        sty $80               ; 8266* 84 80
        sty $82               ; 8268* 84 82
L826A:    ; <- 826F 8276
        lda ($80),y           ; 826A* B1 80
        sta ($82),y           ; 826C* 91 82
        iny                   ; 826E* C8
        bne L826A             ; 826F* D0 F9
        inc $81               ; 8271* E6 81
        inc $83               ; 8273* E6 83
        dex                   ; 8275* CA
        bne L826A             ; 8276* D0 F2
        rts                   ; 8278* 60
memclr_pages:    ; <- 8033
        sta $81               ; 8279* 85 81
        lda #$00              ; 827B* A9 00
        sta $80               ; 827D* 85 80
        tay                   ; 827F* A8
L8280:    ; <- 8283 8288
        sta ($80),y           ; 8280* 91 80
        iny                   ; 8282* C8
        bne L8280             ; 8283* D0 FB
        inc $81               ; 8285* E6 81
        dex                   ; 8287* CA
        bne L8280             ; 8288* D0 F6
        rts                   ; 828A* 60
print_inline_impl:    ; <- 8009
        pla                   ; 828B* 68
        sta $A2               ; 828C* 85 A2
        pla                   ; 828E* 68
        sta $A3               ; 828F* 85 A3
        ldy #$00              ; 8291* A0 00
        sty $A5               ; 8293* 84 A5
        iny                   ; 8295* C8
        lda ($A2),y           ; 8296* B1 A2
        sta $A6               ; 8298* 85 A6
        iny                   ; 829A* C8
        lda ($A2),y           ; 829B* B1 A2
        sta $A7               ; 829D* 85 A7
        iny                   ; 829F* C8
L82A0:    ; <- 82B5
        lda ($A2),y           ; 82A0* B1 A2
        bmi L82B7             ; 82A2* 30 13
        sty $A4               ; 82A4* 84 A4
        ldy reverse_video     ; 82A6* A4 A8
        beq L82AC             ; 82A8* F0 02
        ora #$80              ; 82AA  09 80
L82AC:    ; <- 82A8
        ldy $A5               ; 82AC* A4 A5
        sta ($A6),y           ; 82AE* 91 A6
        inc $A5               ; 82B0* E6 A5
        ldy $A4               ; 82B2* A4 A4
        iny                   ; 82B4* C8
        bne L82A0             ; 82B5* D0 E9
L82B7:    ; <- 82A2
        iny                   ; 82B7* C8
        tya                   ; 82B8* 98
        clc                   ; 82B9* 18
        adc $A2               ; 82BA* 65 A2
        bcc L82C0             ; 82BC* 90 02
        inc $A3               ; 82BE* E6 A3
L82C0:    ; <- 82BC
        sta $A2               ; 82C0* 85 A2
        jmp ($00A2)           ; 82C2* 6C A2 00
L82C5:    ; <- 8036
        ldx #$1C              ; 82C5  A2 1C
        lda #$00              ; 82C7  A9 00
L82C9:    ; <- 82CD
        sta SID,x             ; 82C9  9D 00 D4
        dex                   ; 82CC  CA
        bpl L82C9             ; 82CD  10 FA
        rts                   ; 82CF  60
rnd_impl:    ; <- 8039
        lda #$FF              ; 82D0* A9 FF
        sta $D40E             ; 82D2* 8D 0E D4
        sta $D40F             ; 82D5* 8D 0F D4
        lda #$80              ; 82D8* A9 80
        sta $D412             ; 82DA* 8D 12 D4
        lda SID_OSC3          ; 82DD* AD 1B D4
        rts                   ; 82E0* 60
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 82E1  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 82F1  ...............
kiniport_cursor_show:    ; <- 85CF
        lda player_col        ; 8300  AD 10 0A
        sta D0A17             ; 8303  8D 17 0A
        lda player_row        ; 8306  AD 18 0A
        sta D0A1F             ; 8309  8D 1F 0A
        jsr cursor_place_sprite; 830C  20 BA 87
        lda $D015             ; 830F  AD 15 D0
        ora #$80              ; 8312  09 80
        sta $D015             ; 8314  8D 15 D0
        rts                   ; 8317  60
kiniport_cursor_hide:    ; <- 8627 8634 8694 86CD 875C
        lda $D015             ; 8318  AD 15 D0
        and #$7F              ; 831B  29 7F
        sta $D015             ; 831D  8D 15 D0
        rts                   ; 8320  60
verb_inventory:    ; <- 8403
        jsr jt_clear_text_rows; 8321  20 06 95
        jsr print_inline      ; 8324  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$48,$41,$56,$45,$FF; 8327  I.YOU HAVE.
        lda #$FF              ; 8332  A9 FF
        sta pick_index        ; 8334  8D 54 0A
        sta pick_class        ; 8337  8D 55 0A
        sta cycle_first       ; 833A  85 D2
L833C:    ; <- 8366 8384
        inc pick_index        ; 833C  EE 54 0A
        ldx pick_index        ; 833F  AE 54 0A
        cpx #$FF              ; 8342  E0 FF
        bne L8360             ; 8344  D0 1A
        cpx pick_class        ; 8346  EC 55 0A
        bne L835C             ; 8349  D0 11
        jsr print_inline      ; 834B  20 09 80
        .byte $52,$C3,$4E,$4F,$54,$48,$49,$4E,$47,$20,$FF; 834E  R.NOTHING .
        jmp jt_verb_done      ; 8359  4C 12 AC
L835C:    ; <- 8349
        jsr jt_clear_text_rows; 835C  20 06 95
        rts                   ; 835F  60
L8360:    ; <- 8344
        lda obj_flags,x       ; 8360  BD 00 0F
        bit obj_bit_carried   ; 8363  2C A5 0A
        beq L833C             ; 8366  F0 D4
        lda #$00              ; 8368  A9 00
        sta pick_class        ; 836A  8D 55 0A
        txa                   ; 836D  8A
        jsr jt_object_class   ; 836E  20 09 AC
        lda #$52              ; 8371  A9 52
        sta $80               ; 8373  85 80
        lda #$C3              ; 8375  A9 C3
        sta $81               ; 8377  85 81
        jsr jt_print_item_name; 8379  20 0F AC
        jsr LA818             ; 837C  20 18 A8
L837F:    ; <- 8386
        jsr jt_get_input      ; 837F  20 0F 80
        lda in_dy             ; 8382  A5 99
        bmi L833C             ; 8384  30 B6
        bpl L837F             ; 8386  10 F7
msg_lack_spirit_skill:    ; <- 84BF 851A 85C2 862A
        jsr print_inline      ; 8388  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$4C,$41,$43,$4B,$20,$54,$48,$45,$20,$53; 838B  I.YOU LACK THE S
        .byte $50,$49,$52,$49,$54,$20,$53,$4B,$49,$4C,$4C,$FF; 839B  PIRIT SKILL.
        jmp jt_verb_done      ; 83A7  4C 12 AC
msg_need_spirit_energy:    ; <- 84CA 8525 85CC 8637
        jsr print_inline      ; 83AA  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$4E,$45,$45,$44,$20,$4D,$4F,$52,$45,$20; 83AD  I.YOU NEED MORE 
        .byte $53,$50,$49,$52,$49,$54,$20,$45,$4E,$45,$52,$47,$59,$FF; 83BD  SPIRIT ENERGY.
        jmp jt_verb_done      ; 83CB  4C 12 AC
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 83CE  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 83DE  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 83EE  ................
        .byte $00,$00                                 ; 83FE  ..
game_entry:    ; <- 88DD
        jmp L840F             ; 8400* 4C 0F 84
jt_verb_inventory:    ; <- A901
        jmp verb_inventory    ; 8403  4C 21 83
jt_verb_heal:    ; <- A8EB
        jmp verb_heal         ; 8406  4C B5 84
jt_verb_grunspreke:    ; <- A908
        jmp verb_grunspreke   ; 8409  4C 10 85
jt_verb_kiniport:    ; <- A90B
        jmp verb_kiniport     ; 840C  4C B8 85
L840F:    ; <- 8400
        lda CIA1_CRA          ; 840F* AD 0E DC
        and #$FE              ; 8412* 29 FE
        sta CIA1_CRA          ; 8414* 8D 0E DC
        jsr L801B             ; 8417* 20 1B 80
        ldx #$7F              ; 841A* A2 7F
        lda #$00              ; 841C* A9 00
L841E:    ; <- 8422
        sta zp_shadow,x       ; 841E* 9D 80 08
        dex                   ; 8421* CA
        bpl L841E             ; 8422* 10 FA
        jsr jt_zp_swap        ; 8424* 20 06 80
        lda #$D8              ; 8427* A9 D8
        ldx #$04              ; 8429* A2 04
        jsr jt_memclr_pages   ; 842B* 20 33 80
        lda #$C0              ; 842E* A9 C0
        ldx #$04              ; 8430* A2 04
        jsr jt_memclr_pages   ; 8432* 20 33 80
        lda #$0A              ; 8435* A9 0A
        ldx #$01              ; 8437* A2 01
        jsr jt_memclr_pages   ; 8439* 20 33 80
        lda CIA2_DDRA         ; 843C* AD 02 DD
        ora #$03              ; 843F* 09 03
        sta CIA2_DDRA         ; 8441* 8D 02 DD
        lda CIA2_PRA          ; 8444* AD 00 DD
        and #$FC              ; 8447* 29 FC
        sta CIA2_PRA          ; 8449* 8D 00 DD
        lda #$02              ; 844C* A9 02
        sta VIC_MEM           ; 844E* 8D 18 D0
        jsr L802D             ; 8451* 20 2D 80
        lda #$00              ; 8454* A9 00
        sta VIC_BG0           ; 8456* 8D 21 D0
        lda #$05              ; 8459* A9 05
        sta VIC_BORDER        ; 845B* 8D 20 D0
        ldx #$07              ; 845E* A2 07
L8460:    ; <- 8467
        lda bit_masks,x       ; 8460* BD AD 84
        sta joy_up,x          ; 8463* 9D A0 0A
        dex                   ; 8466* CA
        bpl L8460             ; 8467* 10 F7
        lda #$07              ; 8469* A9 07
        sta $D02E             ; 846B* 8D 2E D0
        lda #$80              ; 846E* A9 80
        sta $D015             ; 8470* 8D 15 D0
        sta DC3FF             ; 8473* 8D FF C3
        lda D0801             ; 8476* AD 01 08
        cmp #$0D              ; 8479* C9 0D
        beq L8480             ; 847B* F0 03
        jmp L8800             ; 847D* 4C 00 88
L8480:    ; <- 847B
        lda CIA2_PRA          ; 8480  AD 00 DD
        ora #$03              ; 8483  09 03
        sta CIA2_PRA          ; 8485  8D 00 DD
        lda #$14              ; 8488  A9 14
        sta VIC_MEM           ; 848A  8D 18 D0
        jsr L8015             ; 848D  20 15 80
        jsr L8021             ; 8490  20 21 80
        jsr L8018             ; 8493  20 18 80
        jsr L8024             ; 8496  20 24 80
        jsr jt_zp_swap        ; 8499  20 06 80
        jsr L801E             ; 849C  20 1E 80
        lda CIA1_CRA          ; 849F  AD 0E DC
        ora #$01              ; 84A2  09 01
        sta CIA1_CRA          ; 84A4  8D 0E DC
        lda #$00              ; 84A7  A9 00
        sta D0801             ; 84A9  8D 01 08
        rts                   ; 84AC  60
; copied to $0AA0-$0AA7, so `bit $0AA5` means `test bit 5 of A`
bit_masks:    ; <- 8460
        .byte $01,$02,$04,$08,$10,$20,$40,$80         ; 84AD  ..... @.
verb_heal:    ; <- 8406
        jsr jt_clear_text_rows; 84B5  20 06 95
        lda spirit_limit      ; 84B8  AD 67 0A
        cmp #$0F              ; 84BB  C9 0F
        bcs L84C2             ; 84BD  B0 03
        jmp msg_lack_spirit_skill; 84BF  4C 88 83
L84C2:    ; <- 84BD
        lda spirit_energy     ; 84C2  AD 63 0A
        sec                   ; 84C5  38
        sbc #$05              ; 84C6  E9 05
        bcs L84CD             ; 84C8  B0 03
        jmp msg_need_spirit_energy; 84CA  4C AA 83
L84CD:    ; <- 84C8
        sta spirit_energy     ; 84CD  8D 63 0A
        clc                   ; 84D0  18
        lda food              ; 84D1  AD 64 0A
        adc #$02              ; 84D4  69 02
        cmp food_max1         ; 84D6  CD 6A 0A
        bcc L84E0             ; 84D9  90 05
        ldx food_max1         ; 84DB  AE 6A 0A
        dex                   ; 84DE  CA
        txa                   ; 84DF  8A
L84E0:    ; <- 84D9
        sta food              ; 84E0  8D 64 0A
        clc                   ; 84E3  18
        lda rest              ; 84E4  AD 65 0A
        adc #$02              ; 84E7  69 02
        cmp rest_max1         ; 84E9  CD 6B 0A
        bcc L84F3             ; 84EC  90 05
        ldx rest_max1         ; 84EE  AE 6B 0A
        dex                   ; 84F1  CA
        txa                   ; 84F2  8A
L84F3:    ; <- 84EC
        sta rest              ; 84F3  8D 65 0A
        jsr print_inline      ; 84F6  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$48,$45,$41,$4C,$20,$59,$4F,$55,$52,$53; 84F9  I.YOU HEAL YOURS
        .byte $45,$4C,$46,$FF                         ; 8509  ELF.
        jmp jt_verb_done      ; 850D  4C 12 AC
verb_grunspreke:    ; <- 8409
        jsr jt_clear_text_rows; 8510  20 06 95
        lda spirit_limit      ; 8513  AD 67 0A
        cmp #$14              ; 8516  C9 14
        bcs L851D             ; 8518  B0 03
        jmp msg_lack_spirit_skill; 851A  4C 88 83
L851D:    ; <- 8518
        lda spirit_energy     ; 851D  AD 63 0A
        sec                   ; 8520  38
        sbc #$02              ; 8521  E9 02
        bcs L8528             ; 8523  B0 03
        jmp msg_need_spirit_energy; 8525  4C AA 83
L8528:    ; <- 8523
        lda tileset_shown     ; 8528  AD 0F 0A
        beq L8554             ; 852B  F0 27
L852D:    ; <- 8560 8564 856D 8571 857D 8585
        jsr print_inline      ; 852D  20 09 80
        .byte $49,$C3,$47,$52,$55,$4E,$53,$50,$52,$45,$4B,$49,$4E,$47,$20,$44; 8530  I.GRUNSPREKING D
        .byte $4F,$45,$53,$4E,$27,$54,$20,$57,$4F,$52,$4B,$20,$48,$45,$52,$45; 8540  OESN'T WORK HERE
        .byte $FF                                     ; 8550  .
        jmp jt_verb_done      ; 8551  4C 12 AC
L8554:    ; <- 852B
        jsr jt_sample_neighbors; 8554  20 00 9C
        lda tile_below        ; 8557  AD 23 0A
        cmp #$DF              ; 855A  C9 DF
        beq L8566             ; 855C  F0 08
        cmp #$02              ; 855E  C9 02
        bcc L852D             ; 8560  90 CB
        cmp #$07              ; 8562  C9 07
        bcs L852D             ; 8564  B0 C7
L8566:    ; <- 855C
        lda player_col        ; 8566  AD 10 0A
        clc                   ; 8569  18
        adc facing            ; 856A  6D 37 0A
        bmi L852D             ; 856D  30 BE
        cmp #$28              ; 856F  C9 28
        bcs L852D             ; 8571  B0 BA
        tax                   ; 8573  AA
        ldy player_row        ; 8574  AC 18 0A
        iny                   ; 8577  C8
        jsr jt_read_tile      ; 8578  20 06 9C
        cmp #$DF              ; 857B  C9 DF
        beq L852D             ; 857D  F0 AE
        cmp #$02              ; 857F  C9 02
        bcc L8587             ; 8581  90 04
        cmp #$07              ; 8583  C9 07
        bcc L852D             ; 8585  90 A6
L8587:    ; <- 8581
        ldy #$00              ; 8587  A0 00
        lda #$DF              ; 8589  A9 DF
        sta ($8C),y           ; 858B  91 8C
        clc                   ; 858D  18
        lda #$18              ; 858E  A9 18
        adc $8D               ; 8590  65 8D
        sta $8D               ; 8592  85 8D
        lda #$09              ; 8594  A9 09
        sta ($8C),y           ; 8596  91 8C
        lda spirit_energy     ; 8598  AD 63 0A
        sec                   ; 859B  38
        sbc #$02              ; 859C  E9 02
        sta spirit_energy     ; 859E  8D 63 0A
        jsr print_inline      ; 85A1  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$4C,$49,$4D,$42,$20,$47,$52,$4F,$57,$53; 85A4  I.THE LIMB GROWS
        .byte $FF                                     ; 85B4  .
        jmp jt_verb_done      ; 85B5  4C 12 AC
verb_kiniport:    ; <- 840C
        jsr jt_clear_text_rows; 85B8  20 06 95
        lda spirit_limit      ; 85BB  AD 67 0A
        cmp #$19              ; 85BE  C9 19
        bcs L85C5             ; 85C0  B0 03
        jmp msg_lack_spirit_skill; 85C2  4C 88 83
L85C5:    ; <- 85C0
        lda spirit_energy     ; 85C5  AD 63 0A
        cmp #$05              ; 85C8  C9 05
        bcs L85CF             ; 85CA  B0 03
        jmp msg_need_spirit_energy; 85CC  4C AA 83
L85CF:    ; <- 85CA
        jsr kiniport_cursor_show; 85CF  20 00 83
        jsr print_inline      ; 85D2  20 09 80
        .byte $49,$C3,$57,$48,$41,$54,$20,$44,$4F,$20,$59,$4F,$55,$20,$57,$41; 85D5  I.WHAT DO YOU WA
        .byte $4E,$54,$20,$54,$4F,$20,$4B,$49,$4E,$49,$50,$4F,$52,$54,$3F,$FF; 85E5  NT TO KINIPORT?.
        jsr jt_wait_input     ; 85F5  20 27 80
        jsr cursor_joystick_loop; 85F8  20 83 87
        jsr jt_clear_text_rows; 85FB  20 06 95
        ldx player_col        ; 85FE  AE 10 0A
        cpx D0A17             ; 8601  EC 17 0A
        beq L8609             ; 8604  F0 03
        jmp L86A3             ; 8606  4C A3 86
L8609:    ; <- 8604
        ldy player_row        ; 8609  AC 18 0A
        cpy D0A1F             ; 860C  CC 1F 0A
        beq L8620             ; 860F  F0 0F
        dey                   ; 8611  88
        cpy D0A1F             ; 8612  CC 1F 0A
        beq L8620             ; 8615  F0 09
        dey                   ; 8617  88
        cpy D0A1F             ; 8618  CC 1F 0A
        beq L8620             ; 861B  F0 03
        jmp L86A3             ; 861D  4C A3 86
L8620:    ; <- 860F 8615 861B
        lda spirit_limit      ; 8620  AD 67 0A
        cmp #$1E              ; 8623  C9 1E
        bcs L862D             ; 8625  B0 06
        jsr kiniport_cursor_hide; 8627  20 18 83
        jmp msg_lack_spirit_skill; 862A  4C 88 83
L862D:    ; <- 8625
        lda spirit_energy     ; 862D  AD 63 0A
        cmp #$0A              ; 8630  C9 0A
        bcs L863A             ; 8632  B0 06
        jsr kiniport_cursor_hide; 8634  20 18 83
        jmp msg_need_spirit_energy; 8637  4C AA 83
L863A:    ; <- 8632
        jsr print_inline      ; 863A  20 09 80
        .byte $49,$C3,$4B,$49,$4E,$49,$50,$4F,$52,$54,$20,$59,$4F,$55,$52,$20; 863D  I.KINIPORT YOUR 
        .byte $42,$4F,$44,$59,$20,$57,$48,$45,$52,$45,$3F,$FF; 864D  BODY WHERE?.
L8659:    ; <- 866F 867D
        jsr jt_wait_input     ; 8659  20 27 80
        jsr cursor_joystick_loop; 865C  20 83 87
        ldx D0A17             ; 865F  AE 17 0A
        ldy D0A1F             ; 8662  AC 1F 0A
        iny                   ; 8665  C8
        jsr jt_read_tile      ; 8666  20 06 9C
        jsr jt_tile_props     ; 8669  20 09 9C
        lda tp_support        ; 866C  AD 2C 0A
        beq L8659             ; 866F  F0 E8
        ldx D0A17             ; 8671  AE 17 0A
        ldy D0A1F             ; 8674  AC 1F 0A
        jsr jt_read_tile      ; 8677  20 06 9C
        jsr L876F             ; 867A  20 6F 87
        bcs L8659             ; 867D  B0 DA
        lda D0A17             ; 867F  AD 17 0A
        sta player_col        ; 8682  8D 10 0A
        sta last_col          ; 8685  8D 0B 0A
        lda D0A1F             ; 8688  AD 1F 0A
        sta player_row        ; 868B  8D 18 0A
        sta last_row          ; 868E  8D 0C 0A
        jsr jt_move_sprite    ; 8691  20 03 9C
        jsr kiniport_cursor_hide; 8694  20 18 83
        lda spirit_energy     ; 8697  AD 63 0A
        sec                   ; 869A  38
        sbc #$0A              ; 869B  E9 0A
        sta spirit_energy     ; 869D  8D 63 0A
        jmp jt_clear_text_rows; 86A0  4C 06 95
L86A3:    ; <- 8606 861D
        ldx D0A17             ; 86A3  AE 17 0A
        ldy D0A1F             ; 86A6  AC 1F 0A
        jsr jt_read_tile      ; 86A9  20 06 9C
        cmp #$E1              ; 86AC  C9 E1
        bcs L86D3             ; 86AE  B0 23
        jsr print_inline      ; 86B0  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$43,$41,$4E,$27,$54,$20,$4B,$49,$4E,$49; 86B3  I.YOU CAN'T KINI
        .byte $50,$4F,$52,$54,$20,$54,$48,$41,$54,$FF ; 86C3  PORT THAT.
        jsr kiniport_cursor_hide; 86CD  20 18 83
        jmp jt_verb_done      ; 86D0  4C 12 AC
L86D3:    ; <- 86AE
        bit joy_up            ; 86D3  2C A0 0A
        bne L86DB             ; 86D6  D0 03
        dec D0A17             ; 86D8  CE 17 0A
L86DB:    ; <- 86D6
        lda D0A17             ; 86DB  AD 17 0A
        sta $84               ; 86DE  85 84
        lda D0A1F             ; 86E0  AD 1F 0A
        sta $85               ; 86E3  85 85
        jsr jt_find_object_at ; 86E5  20 06 B4
        sta kiniport_index    ; 86E8  85 C2
        jsr print_inline      ; 86EA  20 09 80
        .byte $49,$C3,$4B,$49,$4E,$49,$50,$4F,$52,$54,$20,$54,$48,$45,$20,$4F; 86ED  I.KINIPORT THE O
        .byte $42,$4A,$45,$43,$54,$20,$57,$48,$45,$52,$45,$3F,$FF; 86FD  BJECT WHERE?.
L870A:    ; <- 871C 872B 873D 8744
        jsr jt_wait_input     ; 870A  20 27 80
        jsr cursor_joystick_loop; 870D  20 83 87
        ldx D0A17             ; 8710  AE 17 0A
        ldy D0A1F             ; 8713  AC 1F 0A
        jsr jt_read_tile      ; 8716  20 06 9C
        jsr L876B             ; 8719  20 6B 87
        bcs L870A             ; 871C  B0 EC
        ldx D0A17             ; 871E  AE 17 0A
        inx                   ; 8721  E8
        ldy D0A1F             ; 8722  AC 1F 0A
        jsr jt_read_tile      ; 8725  20 06 9C
        jsr L876B             ; 8728  20 6B 87
        bcs L870A             ; 872B  B0 DD
        ldx D0A17             ; 872D  AE 17 0A
        ldy D0A1F             ; 8730  AC 1F 0A
        iny                   ; 8733  C8
        jsr jt_read_tile      ; 8734  20 06 9C
        jsr jt_tile_props     ; 8737  20 09 9C
        lda tp_support        ; 873A  AD 2C 0A
        beq L870A             ; 873D  F0 CB
        ldx D0A17             ; 873F  AE 17 0A
        cpx #$27              ; 8742  E0 27
        beq L870A             ; 8744  F0 C4
        ldx kiniport_index    ; 8746  A6 C2
        lda D0A17             ; 8748  AD 17 0A
        sta obj_col,x         ; 874B  9D 00 0E
        lda obj_flags,x       ; 874E  BD 00 0F
        and #$E0              ; 8751  29 E0
        ora D0A1F             ; 8753  0D 1F 0A
        sta obj_flags,x       ; 8756  9D 00 0F
        jsr L8C03             ; 8759  20 03 8C
        jsr kiniport_cursor_hide; 875C  20 18 83
        lda spirit_energy     ; 875F  AD 63 0A
        sec                   ; 8762  38
        sbc #$05              ; 8763  E9 05
        sta spirit_energy     ; 8765  8D 63 0A
        jmp jt_clear_text_rows; 8768  4C 06 95
L876B:    ; <- 8719 8728
        cmp #$E1              ; 876B  C9 E1
        bcs L8781             ; 876D  B0 12
L876F:    ; <- 867A
        cmp #$07              ; 876F  C9 07
        beq L8781             ; 8771  F0 0E
        cmp #$52              ; 8773  C9 52
        beq L8781             ; 8775  F0 0A
        cmp #$1C              ; 8777  C9 1C
        beq L8781             ; 8779  F0 06
        cmp #$08              ; 877B  C9 08
        beq L8781             ; 877D  F0 02
        clc                   ; 877F  18
        rts                   ; 8780  60
L8781:    ; <- 876D 8771 8775 8779 877D
        sec                   ; 8781  38
        rts                   ; 8782  60
cursor_joystick_loop:    ; <- 85F8 865C 870D 878F 87B7
        jsr jt_get_input      ; 8783  20 0F 80
        beq L878D             ; 8786  F0 05
        ldx #$00              ; 8788  A2 00
        jmp jt_sfx            ; 878A  4C 06 A8
L878D:    ; <- 8786
        lda in_ndirs          ; 878D  A5 9A
        beq cursor_joystick_loop; 878F  F0 F2
        clc                   ; 8791  18
        lda in_dx             ; 8792  A5 98
        adc D0A17             ; 8794  6D 17 0A
        bmi L87A0             ; 8797  30 07
        cmp #$28              ; 8799  C9 28
        bcs L87A0             ; 879B  B0 03
        sta D0A17             ; 879D  8D 17 0A
L87A0:    ; <- 8797 879B
        clc                   ; 87A0  18
        lda in_dy             ; 87A1  A5 99
        adc D0A1F             ; 87A3  6D 1F 0A
        bmi L87AF             ; 87A6  30 07
        cmp #$13              ; 87A8  C9 13
        bcs L87AF             ; 87AA  B0 03
        sta D0A1F             ; 87AC  8D 1F 0A
L87AF:    ; <- 87A6 87AA
        jsr cursor_place_sprite; 87AF  20 BA 87
        ldx #$32              ; 87B2  A2 32
        jsr jt_delay          ; 87B4  20 12 80
        jmp cursor_joystick_loop; 87B7  4C 83 87
cursor_place_sprite:    ; <- 830C 87AF
        ldx D0A1F             ; 87BA  AE 1F 0A
        lda row_to_y,x        ; 87BD  BD 70 0B
        sta $D00F             ; 87C0  8D 0F D0
        ldx D0A17             ; 87C3  AE 17 0A
        cpx #$1E              ; 87C6  E0 1E
        bcs L87D2             ; 87C8  B0 08
        lda $D010             ; 87CA  AD 10 D0
        and #$7F              ; 87CD  29 7F
        jmp L87D7             ; 87CF  4C D7 87
L87D2:    ; <- 87C8
        lda $D010             ; 87D2  AD 10 D0
        ora #$80              ; 87D5  09 80
L87D7:    ; <- 87CF
        sta $D010             ; 87D7  8D 10 D0
        lda col_to_x,x        ; 87DA  BD 40 0B
        sta $D00E             ; 87DD  8D 0E D0
        rts                   ; 87E0  60
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 87E1  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 87F1  ...............
L8800:    ; <- 847D
        jmp L880C             ; 8800* 4C 0C 88
L8803:    ; <- 3444 36F4 9671 9720 A70A AAE8 AB52
        jmp load_room         ; 8803* 4C AC 8B
jt_build_text_font:
        jmp build_text_font   ; 8806  4C 20 8B
L8809:    ; <- 39B8 39E9 3B04 98DE
        jmp raster_irq_setup  ; 8809* 4C 9C 8A
L880C:    ; <- 8800
        jsr jt_clear_screen   ; 880C* 20 09 95
        jsr build_text_font   ; 880F* 20 20 8B
        lda #$02              ; 8812* A9 02
        sta D0A4B             ; 8814* 8D 4B 0A
        jsr L8A7C             ; 8817* 20 7C 8A
        jsr clear_textline    ; 881A* 20 72 8B
        jmp L8987             ; 881D* 4C 87 89
        .byte $20,$ED,$8A,$20,$60,$8B                 ; 8820   .. `.
L8826:    ; <- 8846 88B5 88EE 88F8 8918 892C 8941 8956 896B 8980 8997 89B0 89BD 89C0 89F0 8A26
        jsr jt_zp_swap        ; 8826  20 06 80
        jsr DFF9F             ; 8829  20 9F FF
        ldx $C6               ; 882C  A6 C6
        lda #$00              ; 882E  A9 00
        sta $C6               ; 8830  85 C6
        jsr jt_zp_swap        ; 8832  20 06 80
        cpx #$00              ; 8835  E0 00
        beq L883C             ; 8837  F0 03
        jmp L88B8             ; 8839  4C B8 88
L883C:    ; <- 8837
        jsr jt_get_input      ; 883C  20 0F 80
        beq L8844             ; 883F  F0 03
        jmp L89C3             ; 8841  4C C3 89
L8844:    ; <- 883F 8A0E
        lda in_ndirs          ; 8844  A5 9A
        beq L8826             ; 8846  F0 DE
        clc                   ; 8848  18
        lda in_dx             ; 8849  A5 98
        adc D0A17             ; 884B  6D 17 0A
        bmi L8857             ; 884E  30 07
        cmp #$28              ; 8850  C9 28
        beq L8857             ; 8852  F0 03
        sta D0A17             ; 8854  8D 17 0A
L8857:    ; <- 884E 8852
        clc                   ; 8857  18
        lda in_dy             ; 8858  A5 99
        adc D0A1F             ; 885A  6D 1F 0A
        bmi L8866             ; 885D  30 07
        cmp #$19              ; 885F  C9 19
        beq L8866             ; 8861  F0 03
        sta D0A1F             ; 8863  8D 1F 0A
L8866:    ; <- 885D 8861
        ldx D0A1F             ; 8866  AE 1F 0A
        lda row_to_y,x        ; 8869  BD 70 0B
        sta $D00F             ; 886C  8D 0F D0
        ldx D0A17             ; 886F  AE 17 0A
        cpx #$1E              ; 8872  E0 1E
        bcs L887E             ; 8874  B0 08
        lda $D010             ; 8876  AD 10 D0
        and #$7F              ; 8879  29 7F
        jmp L8883             ; 887B  4C 83 88
L887E:    ; <- 8874
        lda $D010             ; 887E  AD 10 D0
        ora #$80              ; 8881  09 80
L8883:    ; <- 887B
        sta $D010             ; 8883  8D 10 D0
        lda col_to_x,x        ; 8886  BD 40 0B
        sta $D00E             ; 8889  8D 0E D0
        ldx D0A17             ; 888C  AE 17 0A
        ldy #$00              ; 888F  A0 00
        jsr jt_to_decimal     ; 8891  20 0C 80
        lda $95               ; 8894  A5 95
        sta DC321             ; 8896  8D 21 C3
        lda $96               ; 8899  A5 96
        sta DC322             ; 889B  8D 22 C3
        ldx D0A1F             ; 889E  AE 1F 0A
        ldy #$00              ; 88A1  A0 00
        jsr jt_to_decimal     ; 88A3  20 0C 80
        lda $95               ; 88A6  A5 95
        sta DC325             ; 88A8  8D 25 C3
        lda $96               ; 88AB  A5 96
        sta DC326             ; 88AD  8D 26 C3
        ldx #$28              ; 88B0  A2 28
        jsr jt_delay          ; 88B2  20 12 80
        jmp L8826             ; 88B5  4C 26 88
L88B8:    ; <- 8839
        lda D0277             ; 88B8  AD 77 02
        cmp #$5F              ; 88BB  C9 5F
        bne L88E0             ; 88BD  D0 21
        lda $D01A             ; 88BF  AD 1A D0
        and #$FE              ; 88C2  29 FE
        sta $D01A             ; 88C4  8D 1A D0
        sei                   ; 88C7  78
        lda D0A02             ; 88C8  AD 02 0A
        sta D0314             ; 88CB  8D 14 03
        lda D0A03             ; 88CE  AD 03 0A
        sta D0315             ; 88D1  8D 15 03
        cli                   ; 88D4  58
        jsr jt_zp_swap        ; 88D5  20 06 80
        lda #$0D              ; 88D8  A9 0D
        sta D0801             ; 88DA  8D 01 08
        jmp game_entry        ; 88DD  4C 00 84
L88E0:    ; <- 88BD
        cmp #$46              ; 88E0  C9 46
        bne L88F1             ; 88E2  D0 0D
        sec                   ; 88E4  38
        lda #$01              ; 88E5  A9 01
        sbc $BA               ; 88E7  E5 BA
        sta $BA               ; 88E9  85 BA
        jsr L8AED             ; 88EB  20 ED 8A
        jmp L8826             ; 88EE  4C 26 88
L88F1:    ; <- 88E2
        cmp #$50              ; 88F1  C9 50
        bne L88FB             ; 88F3  D0 06
        jsr L8C00             ; 88F5  20 00 8C
        jmp L8826             ; 88F8  4C 26 88
L88FB:    ; <- 88F3
        cmp #$53              ; 88FB  C9 53
        bne L891B             ; 88FD  D0 1C
        jsr L8C00             ; 88FF  20 00 8C
        jsr room_to_ts        ; 8902  20 82 8B
        lda $D01A             ; 8905  AD 1A D0
        and #$FE              ; 8908  29 FE
        sta $D01A             ; 890A  8D 1A D0
        lda #$02              ; 890D  A9 02
        sta VIC_MEM           ; 890F  8D 18 D0
        jsr jt_disk_write_block; 8912  20 00 80
        jsr raster_irq_setup  ; 8915  20 9C 8A
        jmp L8826             ; 8918  4C 26 88
L891B:    ; <- 88FD
        cmp #$4C              ; 891B  C9 4C
        bne L892F             ; 891D  D0 10
        lda #$00              ; 891F  A9 00
        sta $D015             ; 8921  8D 15 D0
        jsr load_room         ; 8924  20 AC 8B
        lda #$80              ; 8927  A9 80
        sta $D015             ; 8929  8D 15 D0
        jmp L8826             ; 892C  4C 26 88
L892F:    ; <- 891D
        cmp #$31              ; 892F  C9 31
        bne L8944             ; 8931  D0 11
        ldx $B7               ; 8933  A6 B7
        inx                   ; 8935  E8
        cpx #$10              ; 8936  E0 10
        bne L893C             ; 8938  D0 02
        ldx #$00              ; 893A  A2 00
L893C:    ; <- 8938
        stx $B7               ; 893C  86 B7
        jsr L8C06             ; 893E  20 06 8C
        jmp L8826             ; 8941  4C 26 88
L8944:    ; <- 8931
        cmp #$32              ; 8944  C9 32
        bne L8959             ; 8946  D0 11
        ldx $B8               ; 8948  A6 B8
        inx                   ; 894A  E8
        cpx #$10              ; 894B  E0 10
        bne L8951             ; 894D  D0 02
        ldx #$00              ; 894F  A2 00
L8951:    ; <- 894D
        stx $B8               ; 8951  86 B8
        jsr L8C06             ; 8953  20 06 8C
        jmp L8826             ; 8956  4C 26 88
L8959:    ; <- 8946
        cmp #$33              ; 8959  C9 33
        bne L896E             ; 895B  D0 11
        ldx $B9               ; 895D  A6 B9
        inx                   ; 895F  E8
        cpx #$10              ; 8960  E0 10
        bne L8966             ; 8962  D0 02
        ldx #$00              ; 8964  A2 00
L8966:    ; <- 8962
        stx $B9               ; 8966  86 B9
        jsr L8C06             ; 8968  20 06 8C
        jmp L8826             ; 896B  4C 26 88
L896E:    ; <- 895B
        cmp #$43              ; 896E  C9 43
        bne L8983             ; 8970  D0 11
        ldx $B6               ; 8972  A6 B6
        inx                   ; 8974  E8
        cpx #$10              ; 8975  E0 10
        bne L897B             ; 8977  D0 02
        ldx #$00              ; 8979  A2 00
L897B:    ; <- 8977
        stx $B6               ; 897B  86 B6
        jsr L8C06             ; 897D  20 06 8C
        jmp L8826             ; 8980  4C 26 88
L8983:    ; <- 8970
        cmp #$54              ; 8983  C9 54
        bne L899A             ; 8985  D0 13
L8987:    ; <- 881D
        lda #$00              ; 8987* A9 00
        sta $D015             ; 8989* 8D 15 D0
        jsr jt_main_menu      ; 898C* 20 00 34
        lda #$80              ; 898F  A9 80
        sta $D015             ; 8991  8D 15 D0
        jsr jt_wait_input     ; 8994  20 27 80
        jmp L8826             ; 8997  4C 26 88
L899A:    ; <- 8985
        cmp #$45              ; 899A  C9 45
        bne L89B3             ; 899C  D0 15
        jsr L9800             ; 899E  20 00 98
        jsr jt_clear_screen   ; 89A1  20 09 95
        jsr L8AED             ; 89A4  20 ED 8A
        jsr raster_irq_setup  ; 89A7  20 9C 8A
        jsr clear_textline    ; 89AA  20 72 8B
        jsr L8B60             ; 89AD  20 60 8B
        jmp L8826             ; 89B0  4C 26 88
L89B3:    ; <- 899C
        cmp #$58              ; 89B3  C9 58
        bne L89C0             ; 89B5  D0 09
        jsr jt_swap_charset_banks; 89B7  20 0C 9C
        jsr L8C03             ; 89BA  20 03 8C
        jmp L8826             ; 89BD  4C 26 88
L89C0:    ; <- 89B5
        jmp L8826             ; 89C0  4C 26 88
L89C3:    ; <- 8841
        lda D0A1F             ; 89C3  AD 1F 0A
        cmp #$14              ; 89C6  C9 14
        bne L89CD             ; 89C8  D0 03
        jmp L8A11             ; 89CA  4C 11 8A
L89CD:    ; <- 89C8
        cmp #$14              ; 89CD  C9 14
        bcc L89F9             ; 89CF  90 28
        tax                   ; 89D1  AA
        lda L89E0,x           ; 89D2  BD E0 89
        clc                   ; 89D5  18
        ldy $BA               ; 89D6  A4 BA
        adc D89F3,y           ; 89D8  79 F3 89
        sta $82               ; 89DB  85 82
        lda D0A17             ; 89DD  AD 17 0A
L89E0:    ; <- 89D2
        cmp #$04              ; 89E0  C9 04
        bcc L89F0             ; 89E2  90 0C
        cmp #$24              ; 89E4  C9 24
        bcs L89F0             ; 89E6  B0 08
        sec                   ; 89E8  38
        sbc #$04              ; 89E9  E9 04
        clc                   ; 89EB  18
        adc $82               ; 89EC  65 82
        sta $B0               ; 89EE  85 B0
L89F0:    ; <- 89E2 89E6
        jmp L8826             ; 89F0  4C 26 88
D89F3:    ; <- 89D8
        .byte $00,$80,$00,$20,$40,$60                 ; 89F3  ... @`
L89F9:    ; <- 89CF
        ldx $B0               ; 89F9  A6 B0
        lda tile_colors,x     ; 89FB  BD 00 C7
        sta $9B               ; 89FE  85 9B
        ldy D0A1F             ; 8A00  AC 1F 0A
        ldx D0A17             ; 8A03  AE 17 0A
        lda $B0               ; 8A06  A5 B0
        jsr L802A             ; 8A08  20 2A 80
        jsr L8C06             ; 8A0B  20 06 8C
        jmp L8844             ; 8A0E  4C 44 88
L8A11:    ; <- 89CA
        lda #$02              ; 8A11  A9 02
        sta VIC_BORDER        ; 8A13  8D 20 D0
        jsr jt_wait_input     ; 8A16  20 27 80
L8A19:    ; <- 8A3B 8A55 8A6C 8A79
        jsr jt_get_input      ; 8A19  20 0F 80
        beq L8A29             ; 8A1C  F0 0B
        lda #$05              ; 8A1E  A9 05
        sta VIC_BORDER        ; 8A20  8D 20 D0
        jsr jt_wait_input     ; 8A23  20 27 80
        jmp L8826             ; 8A26  4C 26 88
L8A29:    ; <- 8A1C
        lda in_dy             ; 8A29  A5 99
        beq L8A39             ; 8A2B  F0 0C
        bmi L8A34             ; 8A2D  30 05
        lda #$01              ; 8A2F  A9 01
        jmp L8A5D             ; 8A31  4C 5D 8A
L8A34:    ; <- 8A2D
        lda #$01              ; 8A34  A9 01
        jmp L8A46             ; 8A36  4C 46 8A
L8A39:    ; <- 8A2B
        lda in_dx             ; 8A39  A5 98
        beq L8A19             ; 8A3B  F0 DC
        bpl L8A44             ; 8A3D  10 05
        lda #$0A              ; 8A3F  A9 0A
        jmp L8A5D             ; 8A41  4C 5D 8A
L8A44:    ; <- 8A3D
        lda #$0A              ; 8A44  A9 0A
L8A46:    ; <- 8A36
        clc                   ; 8A46  18
        adc room_lo           ; 8A47  65 86
        bcc L8A4D             ; 8A49  90 02
        inc room_hi           ; 8A4B  E6 87
L8A4D:    ; <- 8A49
        ldx room_hi           ; 8A4D  A6 87
        cpx #$02              ; 8A4F  E0 02
        bne L8A58             ; 8A51  D0 05
        dec room_hi           ; 8A53  C6 87
        jmp L8A19             ; 8A55  4C 19 8A
L8A58:    ; <- 8A51
        sta room_lo           ; 8A58  85 86
        jmp L8A71             ; 8A5A  4C 71 8A
L8A5D:    ; <- 8A31 8A41
        sec                   ; 8A5D  38
        sta $84               ; 8A5E  85 84
        lda room_lo           ; 8A60  A5 86
        sbc $84               ; 8A62  E5 84
        bcs L8A6F             ; 8A64  B0 09
        dec room_hi           ; 8A66  C6 87
        bpl L8A6F             ; 8A68  10 05
        inc room_hi           ; 8A6A  E6 87
        jmp L8A19             ; 8A6C  4C 19 8A
L8A6F:    ; <- 8A64 8A68
        sta room_lo           ; 8A6F  85 86
L8A71:    ; <- 8A5A
        jsr L8B60             ; 8A71  20 60 8B
        ldx #$40              ; 8A74  A2 40
        jsr jt_delay          ; 8A76  20 12 80
        jmp L8A19             ; 8A79  4C 19 8A
L8A7C:    ; <- 8817
        lda $D011             ; 8A7C* AD 11 D0
        and #$7F              ; 8A7F* 29 7F
        sta $D011             ; 8A81* 8D 11 D0
        lda D0314             ; 8A84* AD 14 03
        sta D0A02             ; 8A87* 8D 02 0A
        lda D0315             ; 8A8A* AD 15 03
        sta D0A03             ; 8A8D* 8D 03 0A
        sei                   ; 8A90* 78
        lda #$8A              ; 8A91* A9 8A
        sta D0315             ; 8A93* 8D 15 03
        lda #$AF              ; 8A96* A9 AF
        sta D0314             ; 8A98* 8D 14 03
        cli                   ; 8A9B* 58
raster_irq_setup:    ; <- 8809 8915 89A7 8BCB
        lda #$D2              ; 8A9C* A9 D2
        sta VIC_RASTER        ; 8A9E* 8D 12 D0
        lda #$FF              ; 8AA1* A9 FF
        sta $D019             ; 8AA3* 8D 19 D0
        lda $D01A             ; 8AA6* AD 1A D0
        ora #$01              ; 8AA9* 09 01
        sta $D01A             ; 8AAB* 8D 1A D0
        rts                   ; 8AAE* 60
        lda #$FF              ; 8AAF* A9 FF
        sta $D019             ; 8AB1* 8D 19 D0
        lda VIC_RASTER        ; 8AB4* AD 12 D0
        cmp #$DE              ; 8AB7* C9 DE
        bcs L8ADA             ; 8AB9* B0 1F
        cmp #$D6              ; 8ABB* C9 D6
        bcs L8ACC             ; 8ABD* B0 0D
        lda #$04              ; 8ABF* A9 04
        sta VIC_MEM           ; 8AC1* 8D 18 D0
        lda #$DA              ; 8AC4* A9 DA
        sta VIC_RASTER        ; 8AC6* 8D 12 D0
        jmp L8AE7             ; 8AC9* 4C E7 8A
L8ACC:    ; <- 8ABD
        lda D0A4B             ; 8ACC* AD 4B 0A
        sta VIC_MEM           ; 8ACF* 8D 18 D0
        lda #$FA              ; 8AD2* A9 FA
        sta VIC_RASTER        ; 8AD4* 8D 12 D0
        jmp L8AE7             ; 8AD7* 4C E7 8A
L8ADA:    ; <- 8AB9
        lda #$D2              ; 8ADA* A9 D2
        sta VIC_RASTER        ; 8ADC* 8D 12 D0
        lda #$02              ; 8ADF* A9 02
        sta VIC_MEM           ; 8AE1* 8D 18 D0
        jsr irq_tick          ; 8AE4* 20 00 A0
L8AE7:    ; <- 8AC9 8AD7
        pla                   ; 8AE7* 68
        tay                   ; 8AE8* A8
        pla                   ; 8AE9* 68
        tax                   ; 8AEA* AA
        pla                   ; 8AEB* 68
        rti                   ; 8AEC* 40
L8AED:    ; <- 88EB 89A4
        ldx $BA               ; 8AED  A6 BA
        lda D8B1E,x           ; 8AEF  BD 1E 8B
        sta $82               ; 8AF2  85 82
        lda #$03              ; 8AF4  A9 03
        sta $85               ; 8AF6  85 85
L8AF8:    ; <- 8B1B
        lda #$1F              ; 8AF8  A9 1F
        sta $84               ; 8AFA  85 84
L8AFC:    ; <- 8B17
        ldx $82               ; 8AFC  A6 82
        lda tile_colors,x     ; 8AFE  BD 00 C7
        sta $9B               ; 8B01  85 9B
        clc                   ; 8B03  18
        lda $84               ; 8B04  A5 84
        adc #$04              ; 8B06  69 04
        tax                   ; 8B08  AA
        lda $85               ; 8B09  A5 85
        adc #$15              ; 8B0B  69 15
        tay                   ; 8B0D  A8
        lda $82               ; 8B0E  A5 82
        jsr L802A             ; 8B10  20 2A 80
        dec $82               ; 8B13  C6 82
        dec $84               ; 8B15  C6 84
        bpl L8AFC             ; 8B17  10 E3
        dec $85               ; 8B19  C6 85
        bpl L8AF8             ; 8B1B  10 DB
        rts                   ; 8B1D  60
D8B1E:    ; <- 8AEF
        .byte $7F,$FF                                 ; 8B1E  ..
; builds the $D000 ASCII text font out of the character ROM
build_text_font:    ; <- 8806 880F
        jsr L8021             ; 8B20* 20 21 80
        jsr L801E             ; 8B23* 20 1E 80
        ldx #$00              ; 8B26* A2 00
L8B28:    ; <- 8B4D
        lda $D100,x           ; 8B28* BD 00 D1
        sta $D100,x           ; 8B2B* 9D 00 D1
        lda $D000,x           ; 8B2E* BD 00 D0
        sta $D200,x           ; 8B31* 9D 00 D2
        lda colorram,x        ; 8B34* BD 00 D8
        sta $D300,x           ; 8B37* 9D 00 D3
        lda $D500,x           ; 8B3A* BD 00 D5
        sta $D500,x           ; 8B3D* 9D 00 D5
        lda SID,x             ; 8B40* BD 00 D4
        sta $D600,x           ; 8B43* 9D 00 D6
        lda CIA1_PRA,x        ; 8B46* BD 00 DC
        sta $D700,x           ; 8B49* 9D 00 D7
        dex                   ; 8B4C* CA
        bne L8B28             ; 8B4D* D0 D9
        lda #$00              ; 8B4F* A9 00
        ldx #$07              ; 8B51* A2 07
vic_clear_loop:    ; <- 8B57
        sta $D000,x           ; 8B53* 9D 00 D0
        dex                   ; 8B56* CA
        bpl vic_clear_loop    ; 8B57* 10 FA
        jsr L801B             ; 8B59* 20 1B 80
        jsr L8024             ; 8B5C* 20 24 80
        rts                   ; 8B5F* 60
L8B60:    ; <- 89AD 8A71
        ldx room_lo           ; 8B60  A6 86
        ldy room_hi           ; 8B62  A4 87
        jsr jt_to_decimal     ; 8B64  20 0C 80
        ldx #$02              ; 8B67  A2 02
L8B69:    ; <- 8B6F
        lda $94,x             ; 8B69  B5 94
        sta DC33F,x           ; 8B6B  9D 3F C3
        dex                   ; 8B6E  CA
        bpl L8B69             ; 8B6F  10 F8
        rts                   ; 8B71  60
clear_textline:    ; <- 881A 89AA 8BD4
        ldx #$27              ; 8B72* A2 27
L8B74:    ; <- 8B7F
        lda #$01              ; 8B74* A9 01
        sta textline_color,x  ; 8B76* 9D 20 DB
        lda #$00              ; 8B79* A9 00
        sta textline,x        ; 8B7B* 9D 20 C3
        dex                   ; 8B7E* CA
        bpl L8B74             ; 8B7F* 10 F3
        rts                   ; 8B81* 60
room_to_ts:    ; <- 8902 8BAC
        lda #$02              ; 8B82* A9 02
        sta blk_track         ; 8B84* 8D 00 0A
        lda room_lo           ; 8B87* A5 86
        sta $80               ; 8B89* 85 80
        lda room_hi           ; 8B8B* A5 87
        sta $81               ; 8B8D* 85 81
L8B8F:    ; <- 8BA1
        sec                   ; 8B8F* 38
        lda $80               ; 8B90* A5 80
        sbc #$12              ; 8B92* E9 12
        sta $80               ; 8B94* 85 80
        lda $81               ; 8B96* A5 81
        sbc #$00              ; 8B98* E9 00
        sta $81               ; 8B9A* 85 81
        bmi L8BA3             ; 8B9C* 30 05
        inc blk_track         ; 8B9E* EE 00 0A
        bne L8B8F             ; 8BA1* D0 EC
L8BA3:    ; <- 8B9C
        clc                   ; 8BA3* 18
        lda $80               ; 8BA4* A5 80
        adc #$12              ; 8BA6* 69 12
        sta blk_sector        ; 8BA8* 8D 01 0A
        rts                   ; 8BAB* 60
load_room:    ; <- 8803 8924
        jsr room_to_ts        ; 8BAC* 20 82 8B
        jsr clear_textline_color; 8BAF* 20 D8 8B
        lda #$00              ; 8BB2* A9 00
        sta $D015             ; 8BB4* 8D 15 D0
        sta take_permission   ; 8BB7* 85 CC
        sta door_permission   ; 8BB9* 85 CD
        lda $D01A             ; 8BBB* AD 1A D0
        and #$FE              ; 8BBE* 29 FE
        sta $D01A             ; 8BC0* 8D 1A D0
        lda #$02              ; 8BC3* A9 02
        sta VIC_MEM           ; 8BC5* 8D 18 D0
        jsr jt_disk_read_block; 8BC8* 20 03 80
        jsr raster_irq_setup  ; 8BCB* 20 9C 8A
        jsr L950C             ; 8BCE* 20 0C 95
        jsr L8C03             ; 8BD1* 20 03 8C
        jsr clear_textline    ; 8BD4* 20 72 8B
        rts                   ; 8BD7* 60
clear_textline_color:    ; <- 8BAF
        ldx #$27              ; 8BD8* A2 27
        lda #$00              ; 8BDA* A9 00
L8BDC:    ; <- 8BE0
        sta textline_color,x  ; 8BDC* 9D 20 DB
        dex                   ; 8BDF* CA
        bpl L8BDC             ; 8BE0* 10 FA
        rts                   ; 8BE2* 60
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 8BE3  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 8BF3  .............
L8C00:    ; <- 88F5 88FF
        jmp L8D33             ; 8C00  4C 33 8D
L8C03:    ; <- 8759 89BA 8BD1 ADED AFA8
        jmp decode_room_tiles ; 8C03* 4C 34 8D
L8C06:    ; <- 893E 8953 8968 897D 8A0B
        jmp recolor_screen    ; 8C06  4C ED 8C
L8C09:    ; <- 90E2
        jmp blit_screen       ; 8C09  4C 0C 8C
blit_screen:    ; <- 8C09 8D9E
        lda #$00              ; 8C0C* A9 00
        sta $88               ; 8C0E* 85 88
        sta $80               ; 8C10* 85 80
        sta $8A               ; 8C12* 85 8A
        lda #$C3              ; 8C14* A9 C3
        sta $89               ; 8C16* 85 89
        lda #$07              ; 8C18* A9 07
        sta $81               ; 8C1A* 85 81
        lda #$DB              ; 8C1C* A9 DB
        sta $8B               ; 8C1E* 85 8B
        lda #$04              ; 8C20* A9 04
        sta $84               ; 8C22* 85 84
        jmp blit_screen_dark  ; 8C24* 4C 6D 8C
blit_screen_loop:    ; <- 8C9D
        ldy #$1F              ; 8C27* A0 1F
L8C29:    ; <- 8C60 8C6A
        lda ($80),y           ; 8C29* B1 80
        cmp #$52              ; 8C2B* C9 52
        bcc L8C53             ; 8C2D* 90 24
        cmp #$59              ; 8C2F* C9 59
        bcs L8C38             ; 8C31* B0 05
        lda $B7               ; 8C33* A5 B7
        jmp L8C57             ; 8C35* 4C 57 8C
L8C38:    ; <- 8C31
        cmp #$73              ; 8C38* C9 73
        bcs L8C41             ; 8C3A* B0 05
        lda $B8               ; 8C3C* A5 B8
        jmp L8C57             ; 8C3E* 4C 57 8C
L8C41:    ; <- 8C3A
        cmp #$77              ; 8C41* C9 77
        bcs L8C4A             ; 8C43* B0 05
        lda $B9               ; 8C45* A5 B9
        jmp L8C57             ; 8C47* 4C 57 8C
L8C4A:    ; <- 8C43
        cmp #$B4              ; 8C4A* C9 B4
        bcs L8C53             ; 8C4C* B0 05
        lda $B6               ; 8C4E* A5 B6
        jmp L8C57             ; 8C50* 4C 57 8C
L8C53:    ; <- 8C2D 8C4C
        tax                   ; 8C53* AA
        lda tile_colors,x     ; 8C54* BD 00 C7
L8C57:    ; <- 8C35 8C3E 8C47 8C50
        sta ($8A),y           ; 8C57* 91 8A
        lda ($80),y           ; 8C59* B1 80
        sta ($88),y           ; 8C5B* 91 88
        dey                   ; 8C5D* 88
        cpy #$FF              ; 8C5E* C0 FF
        bne L8C29             ; 8C60* D0 C7
        dec $89               ; 8C62* C6 89
        dec $8B               ; 8C64* C6 8B
        dec $81               ; 8C66* C6 81
        dec $84               ; 8C68* C6 84
        bne L8C29             ; 8C6A* D0 BD
        rts                   ; 8C6C* 60
; rooms >= $180 go black unless the spirit lamp or a lit honeylamp
blit_screen_dark:    ; <- 8C24
        lda room_hi           ; 8C6D* A5 87
        beq L8C9D             ; 8C6F* F0 2C
        lda room_lo           ; 8C71  A5 86
        cmp #$80              ; 8C73  C9 80
        bcc L8C9D             ; 8C75  90 26
        lda obj_spirit_lamp   ; 8C77  AD 01 0F
        bit obj_bit_carried   ; 8C7A  2C A5 0A
        bne L8C9D             ; 8C7D  D0 1E
        lda lamp_index        ; 8C7F  A5 CA
        bne L8C9D             ; 8C81  D0 1A
        ldy #$1F              ; 8C83  A0 1F
L8C85:    ; <- 8C90 8C9A
        lda #$00              ; 8C85  A9 00
        sta ($8A),y           ; 8C87  91 8A
        lda ($80),y           ; 8C89  B1 80
        sta ($88),y           ; 8C8B  91 88
        dey                   ; 8C8D  88
        cpy #$FF              ; 8C8E  C0 FF
        bne L8C85             ; 8C90  D0 F3
        dec $8B               ; 8C92  C6 8B
        dec $81               ; 8C94  C6 81
        dec $89               ; 8C96  C6 89
        dec $84               ; 8C98  C6 84
        bne L8C85             ; 8C9A  D0 E9
        rts                   ; 8C9C  60
L8C9D:    ; <- 8C6F 8C75 8C7D 8C81
        jmp blit_screen_loop  ; 8C9D* 4C 27 8C
; the only room content that is not in the room block
place_objects:    ; <- 8D9B
        ldx #$00              ; 8CA0* A2 00
L8CA2:    ; <- 8CEA
        lda obj_room_lo,x     ; 8CA2* BD 00 0D
        cmp room_lo           ; 8CA5* C5 86
        bne L8CE9             ; 8CA7* D0 40
        lda obj_flags,x       ; 8CA9* BD 00 0F
        asl a                 ; 8CAC* 0A
        lda #$00              ; 8CAD* A9 00
        rol a                 ; 8CAF* 2A
        cmp room_hi           ; 8CB0* C5 87
        bne L8CE9             ; 8CB2* D0 35
        lda obj_flags,x       ; 8CB4* BD 00 0F
        bit obj_bit_exists    ; 8CB7* 2C A6 0A
        beq L8CE9             ; 8CBA* F0 2D
        bit obj_bit_carried   ; 8CBC* 2C A5 0A
        bne L8CE9             ; 8CBF* D0 28
        and #$1F              ; 8CC1* 29 1F
        tay                   ; 8CC3* A8
        lda row_addr_lo,y     ; 8CC4* B9 00 0B
        sta $80               ; 8CC7* 85 80
        lda row_addr_hi,y     ; 8CC9* B9 20 0B
        sec                   ; 8CCC* 38
        sbc #$BC              ; 8CCD* E9 BC
        sta $81               ; 8CCF* 85 81
        txa                   ; 8CD1* 8A
        jsr jt_object_class   ; 8CD2* 20 09 AC
        sty $84               ; 8CD5* 84 84
        asl $84               ; 8CD7* 06 84
        lda #$FD              ; 8CD9* A9 FD
        sec                   ; 8CDB* 38
        sbc $84               ; 8CDC* E5 84
        ldy obj_col,x         ; 8CDE* BC 00 0E
        sta ($80),y           ; 8CE1* 91 80
        iny                   ; 8CE3* C8
        clc                   ; 8CE4* 18
        adc #$01              ; 8CE5* 69 01
        sta ($80),y           ; 8CE7* 91 80
L8CE9:    ; <- 8CA7 8CB2 8CBA 8CBF
        inx                   ; 8CE9* E8
        bne L8CA2             ; 8CEA* D0 B6
        rts                   ; 8CEC* 60
recolor_screen:    ; <- 8C06
        lda #$00              ; 8CED  A9 00
        sta $88               ; 8CEF  85 88
        sta $8A               ; 8CF1  85 8A
        lda #$C0              ; 8CF3  A9 C0
        sta $89               ; 8CF5  85 89
        lda #$D8              ; 8CF7  A9 D8
        sta $8B               ; 8CF9  85 8B
L8CFB:    ; <- 8D30
        ldy #$00              ; 8CFB  A0 00
        lda ($88),y           ; 8CFD  B1 88
        cmp #$52              ; 8CFF  C9 52
        bcc L8D27             ; 8D01  90 24
        cmp #$59              ; 8D03  C9 59
        bcs L8D0C             ; 8D05  B0 05
        lda $B7               ; 8D07  A5 B7
        jmp L8D2B             ; 8D09  4C 2B 8D
L8D0C:    ; <- 8D05
        cmp #$73              ; 8D0C  C9 73
        bcs L8D15             ; 8D0E  B0 05
        lda $B8               ; 8D10  A5 B8
        jmp L8D2B             ; 8D12  4C 2B 8D
L8D15:    ; <- 8D0E
        cmp #$77              ; 8D15  C9 77
        bcs L8D1E             ; 8D17  B0 05
        lda $B9               ; 8D19  A5 B9
        jmp L8D2B             ; 8D1B  4C 2B 8D
L8D1E:    ; <- 8D17
        cmp #$B4              ; 8D1E  C9 B4
        bcs L8D27             ; 8D20  B0 05
        lda $B6               ; 8D22  A5 B6
        jmp L8D2B             ; 8D24  4C 2B 8D
L8D27:    ; <- 8D01 8D20
        tax                   ; 8D27  AA
        lda tile_colors,x     ; 8D28  BD 00 C7
L8D2B:    ; <- 8D09 8D12 8D1B 8D24
        sta ($8A),y           ; 8D2B  91 8A
        jsr screen_ptr_next   ; 8D2D  20 38 8E
        beq L8CFB             ; 8D30  F0 C9
        rts                   ; 8D32  60
L8D33:    ; <- 8C00
        nop                   ; 8D33  EA
decode_room_tiles:    ; <- 8C03
        ldx #$03              ; 8D34* A2 03
L8D36:    ; <- 8D3C
        lda blk_colors,x      ; 8D36* BD FB 09
        sta $B6,x             ; 8D39* 95 B6
        dex                   ; 8D3B* CA
        bpl L8D36             ; 8D3C* 10 F8
        lda #$00              ; 8D3E* A9 00
        sta $88               ; 8D40* 85 88
        sta $8A               ; 8D42* 85 8A
        lda #$C0              ; 8D44* A9 C0
        sta $89               ; 8D46* 85 89
        lda #$04              ; 8D48* A9 04
        sta $8B               ; 8D4A* 85 8B
        lda #$00              ; 8D4C* A9 00
        sta $82               ; 8D4E* 85 82
room_rle_loop:    ; <- 8D60 8D7F
        ldx $82               ; 8D50* A6 82
        inc $82               ; 8D52* E6 82
        lda blk_buf,x         ; 8D54* BD 00 09
        bmi L8D63             ; 8D57* 30 0A
        ldy #$00              ; 8D59* A0 00
        sta ($8A),y           ; 8D5B* 91 8A
        jsr room_advance      ; 8D5D* 20 82 8D
        jmp room_rle_loop     ; 8D60* 4C 50 8D
L8D63:    ; <- 8D57
        and #$7F              ; 8D63* 29 7F
        sta $84               ; 8D65* 85 84
        ldx $82               ; 8D67* A6 82
        inc $82               ; 8D69* E6 82
        lda blk_buf,x         ; 8D6B* BD 00 09
        sta $83               ; 8D6E* 85 83
        inc $83               ; 8D70* E6 83
L8D72:    ; <- 8D7D
        ldy #$00              ; 8D72* A0 00
        lda $84               ; 8D74* A5 84
        sta ($8A),y           ; 8D76* 91 8A
        jsr room_advance      ; 8D78* 20 82 8D
        dec $83               ; 8D7B* C6 83
        bne L8D72             ; 8D7D* D0 F3
        jmp room_rle_loop     ; 8D7F* 4C 50 8D
room_advance:    ; <- 8D5D 8D78
        jsr screen_ptr_next   ; 8D82* 20 38 8E
        bne L8D88             ; 8D85* D0 01
        rts                   ; 8D87* 60
L8D88:    ; <- 8D85
        pla                   ; 8D88* 68
        pla                   ; 8D89* 68
room_opcodes:    ; <- 8E04 8E35
        ldx $82               ; 8D8A* A6 82
        lda blk_buf,x         ; 8D8C* BD 00 09
        pha                   ; 8D8F* 48
        and #$1F              ; 8D90* 29 1F
        sta $83               ; 8D92* 85 83
        pla                   ; 8D94* 68
        and #$E0              ; 8D95* 29 E0
        cmp #$E0              ; 8D97* C9 E0
        bne L8DA2             ; 8D99* D0 07
        jsr place_objects     ; 8D9B* 20 A0 8C
        jsr blit_screen       ; 8D9E* 20 0C 8C
        rts                   ; 8DA1* 60
L8DA2:    ; <- 8D99
        cmp #$20              ; 8DA2* C9 20
        bne L8DA8             ; 8DA4* D0 02
        ldy #$B4              ; 8DA6* A0 B4
L8DA8:    ; <- 8DA4
        cmp #$40              ; 8DA8* C9 40
        bne L8DAE             ; 8DAA* D0 02
        ldy #$B7              ; 8DAC* A0 B7
L8DAE:    ; <- 8DAA
        cmp #$80              ; 8DAE* C9 80
        bne L8DB4             ; 8DB0* D0 02
        ldy #$BA              ; 8DB2  A0 BA
L8DB4:    ; <- 8DB0
        cmp #$A0              ; 8DB4* C9 A0
        bne L8DBA             ; 8DB6* D0 02
        ldy #$BB              ; 8DB8  A0 BB
L8DBA:    ; <- 8DB6
        cmp #$C0              ; 8DBA* C9 C0
        bne L8DC0             ; 8DBC* D0 02
        ldy #$BC              ; 8DBE* A0 BC
L8DC0:    ; <- 8DBC
        cmp #$60              ; 8DC0* C9 60
        beq room_pair_run     ; 8DC2* F0 43
        sty $80               ; 8DC4* 84 80
        inx                   ; 8DC6* E8
        lda blk_buf,x         ; 8DC7* BD 00 09
        sta $88               ; 8DCA* 85 88
        sta $8A               ; 8DCC* 85 8A
        inx                   ; 8DCE* E8
        lda blk_buf,x         ; 8DCF* BD 00 09
        sta $89               ; 8DD2* 85 89
        inx                   ; 8DD4* E8
        stx $82               ; 8DD5* 86 82
        sec                   ; 8DD7* 38
        sbc #$BC              ; 8DD8* E9 BC
        sta $8B               ; 8DDA* 85 8B
room_paint_column:    ; <- 8E02
        ldy #$00              ; 8DDC* A0 00
        ldx $80               ; 8DDE* A6 80
        lda #$03              ; 8DE0* A9 03
        sta $84               ; 8DE2* 85 84
L8DE4:    ; <- 8DEF
        txa                   ; 8DE4* 8A
        sta ($8A),y           ; 8DE5* 91 8A
        cpx #$BA              ; 8DE7* E0 BA
        bcs L8DEC             ; 8DE9* B0 01
        inx                   ; 8DEB* E8
L8DEC:    ; <- 8DE9
        iny                   ; 8DEC* C8
        dec $84               ; 8DED* C6 84
        bne L8DE4             ; 8DEF* D0 F3
        clc                   ; 8DF1* 18
        lda $88               ; 8DF2* A5 88
        adc #$28              ; 8DF4* 69 28
        sta $88               ; 8DF6* 85 88
        sta $8A               ; 8DF8* 85 8A
        bcc L8E00             ; 8DFA* 90 04
        inc $89               ; 8DFC* E6 89
        inc $8B               ; 8DFE* E6 8B
L8E00:    ; <- 8DFA
        dec $83               ; 8E00* C6 83
        bne room_paint_column ; 8E02* D0 D8
        jmp room_opcodes      ; 8E04* 4C 8A 8D
room_pair_run:    ; <- 8DC2
        inx                   ; 8E07* E8
        lda blk_buf,x         ; 8E08* BD 00 09
        sta $88               ; 8E0B* 85 88
        sta $8A               ; 8E0D* 85 8A
        inx                   ; 8E0F* E8
        lda blk_buf,x         ; 8E10* BD 00 09
        sta $89               ; 8E13* 85 89
        sec                   ; 8E15* 38
        sbc #$BC              ; 8E16* E9 BC
        sta $8B               ; 8E18* 85 8B
        inx                   ; 8E1A* E8
L8E1B:    ; <- 8E31
        ldy #$00              ; 8E1B* A0 00
        lda blk_buf,x         ; 8E1D* BD 00 09
        inx                   ; 8E20* E8
        sta ($8A),y           ; 8E21* 91 8A
        clc                   ; 8E23* 18
        adc #$01              ; 8E24* 69 01
        iny                   ; 8E26* C8
        sta ($8A),y           ; 8E27* 91 8A
        jsr screen_ptr_next   ; 8E29* 20 38 8E
        jsr screen_ptr_next   ; 8E2C* 20 38 8E
        dec $83               ; 8E2F* C6 83
        bne L8E1B             ; 8E31* D0 E8
        stx $82               ; 8E33* 86 82
        jmp room_opcodes      ; 8E35* 4C 8A 8D
screen_ptr_next:    ; <- 8D2D 8D82 8E29 8E2C
        inc $8A               ; 8E38* E6 8A
        inc $88               ; 8E3A* E6 88
        bne L8E42             ; 8E3C* D0 04
        inc $8B               ; 8E3E* E6 8B
        inc $89               ; 8E40* E6 89
L8E42:    ; <- 8E3C
        lda $88               ; 8E42* A5 88
        cmp #$20              ; 8E44* C9 20
        bne L8E51             ; 8E46* D0 09
        lda $89               ; 8E48* A5 89
        cmp #$C3              ; 8E4A* C9 C3
        bne L8E51             ; 8E4C* D0 03
        lda #$01              ; 8E4E* A9 01
        rts                   ; 8E50* 60
L8E51:    ; <- 8E46 8E4C
        lda #$00              ; 8E51* A9 00
        rts                   ; 8E53* 60
        .byte $09,$E8,$A5,$88,$9D,$00,$09,$E8,$A5,$89,$9D,$00; 8E54  ............
L8E60:    ; <- 9747
        lda room_hi           ; 8E60  A5 87
        bne L8E6E             ; 8E62  D0 0A
        lda room_lo           ; 8E64  A5 86
        cmp #$BE              ; 8E66  C9 BE
        bne L8E6D             ; 8E68  D0 03
L8E6A:    ; <- 8E74
        jsr jt_play_random_tune; 8E6A  20 12 3C
L8E6D:    ; <- 8E68 8E72
        rts                   ; 8E6D  60
L8E6E:    ; <- 8E62
        lda room_lo           ; 8E6E  A5 86
        cmp #$80              ; 8E70  C9 80
        bne L8E6D             ; 8E72  D0 F9
        beq L8E6A             ; 8E74  F0 F4
quest_time_over:    ; <- 95A2
        lda #$04              ; 8E76  A9 04
        sta D0A4B             ; 8E78  8D 4B 0A
        jsr print_inline      ; 8E7B  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$4C,$49,$47,$48,$54,$20,$46,$41,$44,$45; 8E7E  I.THE LIGHT FADE
        .byte $53,$20,$49,$4E,$54,$4F,$20,$44,$41,$52,$4B,$4E,$45,$53,$53,$2E; 8E8E  S INTO DARKNESS.
        .byte $2E,$2E,$FF                             ; 8E9E  ...
        jsr print_inline      ; 8EA1  20 09 80
        .byte $71,$C3,$54,$48,$45,$20,$54,$49,$4D,$45,$20,$46,$4F,$52,$20,$59; 8EA4  q.THE TIME FOR Y
        .byte $4F,$55,$52,$20,$51,$55,$45,$53,$54,$20,$48,$41,$53,$20,$45,$4E; 8EB4  OUR QUEST HAS EN
        .byte $44,$45,$44,$2E,$FF                     ; 8EC4  DED..
        jsr print_inline      ; 8EC9  20 09 80
        .byte $99,$C3,$47,$52,$45,$45,$4E,$2D,$53,$4B,$59,$20,$41,$57,$41,$49; 8ECC  ..GREEN-SKY AWAI
        .byte $54,$53,$20,$54,$48,$45,$20,$52,$49,$53,$45,$20,$4F,$46,$20,$41; 8EDC  TS THE RISE OF A
        .byte $4E,$4F,$54,$48,$45,$52,$20,$20,$20,$20,$51,$55,$45,$53,$54,$45; 8EEC  NOTHER    QUESTE
        .byte $52,$2E,$FF                             ; 8EFC  R..
        lda #$00              ; 8EFF  A9 00
        jsr jt_music_play     ; 8F01  20 00 28
L8F04:    ; <- 8F07
        lda music_on          ; 8F04  AD 95 0A
        bne L8F04             ; 8F07  D0 FB
L8F09:    ; <- 8F0C
        jsr jt_get_input      ; 8F09  20 0F 80
        beq L8F09             ; 8F0C  F0 FB
        lda #$00              ; 8F0E  A9 00
        sta quest_time_up     ; 8F10  85 DE
        sta quest_active      ; 8F12  85 D7
        jmp jt_main_menu      ; 8F14  4C 00 34
        .byte $60,$C9,$20,$D0,$02,$A0,$B4,$C9,$40     ; 8F17  `. .....@
L8F20:    ; <- A35D
        jsr rnd               ; 8F20* 20 39 80
        cmp #$F0              ; 8F23* C9 F0
        bcc L8F34             ; 8F25* 90 0D
        ldx #$13              ; 8F27* A2 13
L8F29:    ; <- 8F32
        lda obj_class_shuba,x ; 8F29* BD 58 0F
        bit obj_bit_carried   ; 8F2C* 2C A5 0A
        bne L8F35             ; 8F2F* D0 04
        dex                   ; 8F31* CA
        bpl L8F29             ; 8F32* 10 F5
L8F34:    ; <- 8F25
        rts                   ; 8F34* 60
L8F35:    ; <- 8F2F
        lda #$04              ; 8F35  A9 04
        sta D0A4B             ; 8F37  8D 4B 0A
        lda #$00              ; 8F3A  A9 00
        sta obj_class_shuba,x ; 8F3C  9D 58 0F
        ldy #$07              ; 8F3F  A0 07
        jsr jt_subtract_weight; 8F41  20 0C AC
        jsr print_inline      ; 8F44  20 09 80
        .byte $49,$C3,$59,$4F,$55,$52,$20,$53,$48,$55,$42,$41,$20,$48,$41,$53; 8F47  I.YOUR SHUBA HAS
        .byte $20,$54,$4F,$52,$4E,$FF                 ; 8F57   TORN.
        rts                   ; 8F5D  60
        .byte $BA,$B0,$01,$E8,$C8,$C6,$84,$D0,$F3,$18,$A5,$88,$69,$28,$85,$88; 8F5E  ............i(..
        .byte $85,$8A,$90,$04,$E6,$89,$E6,$8B,$C6,$83,$D0,$D8,$4C,$00,$8F,$E8; 8F6E  ............L...
        .byte $BD,$00,$09,$85,$88,$85,$8A,$E8,$BD,$00,$09,$85,$89,$38,$E9,$BC; 8F7E  .............8..
        .byte $85,$8B,$E8,$A0,$00,$BD,$00,$09,$E8,$91,$8A,$18,$69,$01,$C8,$91; 8F8E  ............i...
        .byte $8A,$20,$AE,$8F,$20,$AE,$8F,$C6,$83,$D0,$E8,$86,$82,$4C,$00,$8F; 8F9E  . .. ........L..
        .byte $E6,$8A,$E6,$88,$D0,$04,$E6,$8B,$E6,$89,$A5,$88,$C9,$20,$D0,$09; 8FAE  ............. ..
        .byte $A5,$89,$C9,$C3,$D0,$03,$A9,$01,$60,$A9,$00,$60,$00,$00,$00,$00; 8FBE  ........`..`....
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 8FCE  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 8FDE  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 8FEE  ................
        .byte $00,$00                                 ; 8FFE  ..
verb_use:    ; <- A8CE
        jsr jt_clear_text_rows; 9000  20 06 95
        jsr print_inline      ; 9003  20 09 80
        .byte $49,$C3,$55,$53,$45,$20,$57,$48,$41,$54,$3F,$FF; 9006  I.USE WHAT?.
        lda #$FF              ; 9012  A9 FF
        sta pick_index        ; 9014  8D 54 0A
        sta pick_class        ; 9017  8D 55 0A
        sta cycle_first       ; 901A  85 D2
        jsr jt_wait_input     ; 901C  20 27 80
L901F:    ; <- 904A 9053 9058 9074
        inc pick_index        ; 901F  EE 54 0A
        ldx pick_index        ; 9022  AE 54 0A
        cpx #$FF              ; 9025  E0 FF
        bne L9045             ; 9027  D0 1C
        stx pick_class        ; 9029  8E 55 0A
        jsr print_inline      ; 902C  20 09 80
        .byte $54,$C3,$4E,$4F,$54,$48,$49,$4E,$47,$20,$20,$20,$20,$20,$20,$20; 902F  T.NOTHING       
        .byte $20,$20,$FF                             ; 903F    .
        jmp L9068             ; 9042  4C 68 90
L9045:    ; <- 9027
        lda obj_flags,x       ; 9045  BD 00 0F
        and #$20              ; 9048  29 20
        beq L901F             ; 904A  F0 D3
        txa                   ; 904C  8A
        jsr jt_object_class   ; 904D  20 09 AC
        lda item_usable,y     ; 9050  B9 77 90
        beq L901F             ; 9053  F0 CA
        cpy pick_class        ; 9055  CC 55 0A
        beq L901F             ; 9058  F0 C5
        sty pick_class        ; 905A  8C 55 0A
        lda #$54              ; 905D  A9 54
        sta $80               ; 905F  85 80
        lda #$C3              ; 9061  A9 C3
        sta $81               ; 9063  85 81
        jsr jt_print_item_name; 9065  20 0F AC
L9068:    ; <- 9042
        jsr LA818             ; 9068  20 18 A8
L906B:    ; <- 9072
        jsr jt_get_input      ; 906B  20 0F 80
        bne L9086             ; 906E  D0 16
        lda in_dy             ; 9070  A5 99
        bpl L906B             ; 9072  10 F7
        jmp L901F             ; 9074  4C 1F 90
item_usable:    ; <- 9050
        .byte $00,$00,$01,$01,$00,$00,$00,$00,$00,$01,$00,$01,$01,$01,$00; 9077  ...............
L9086:    ; <- 906E
        jsr jt_clear_text_rows; 9086  20 06 95
        lda pick_index        ; 9089  AD 54 0A
        cmp #$FF              ; 908C  C9 FF
        bne L9091             ; 908E  D0 01
        rts                   ; 9090  60
L9091:    ; <- 908E
        lda pick_class        ; 9091  AD 55 0A
        cmp #$02              ; 9094  C9 02
        bne L90E8             ; 9096  D0 50
        lda lamp_index        ; 9098  A5 CA
        beq L90BD             ; 909A  F0 21
        jsr print_inline      ; 909C  20 09 80
        .byte $49,$C3,$59,$4F,$55,$52,$20,$4C,$41,$4D,$50,$20,$49,$53,$20,$41; 909F  I.YOUR LAMP IS A
        .byte $4C,$52,$45,$41,$44,$59,$20,$4C,$49,$54,$FF; 90AF  LREADY LIT.
        jmp jt_verb_done      ; 90BA  4C 12 AC
L90BD:    ; <- 909A
        lda pick_index        ; 90BD  AD 54 0A
        sta lamp_index        ; 90C0  85 CA
        jsr rnd               ; 90C2  20 39 80
        and #$03              ; 90C5  29 03
        clc                   ; 90C7  18
        adc #$0A              ; 90C8  69 0A
        sta lamp_fuel         ; 90CA  85 CB
        jsr print_inline      ; 90CC  20 09 80
        .byte $49,$C3,$59,$4F,$55,$52,$20,$4C,$41,$4D,$50,$20,$49,$53,$20,$4C; 90CF  I.YOUR LAMP IS L
        .byte $49,$54,$FF                             ; 90DF  IT.
        jsr L8C09             ; 90E2  20 09 8C
        jmp jt_verb_done      ; 90E5  4C 12 AC
L90E8:    ; <- 9096
        cmp #$03              ; 90E8  C9 03
        bne L913C             ; 90EA  D0 50
        jsr wand_of_befal_hit ; 90EC  20 3A 93
        bcs L90FD             ; 90EF  B0 0C
        lda #$1C              ; 90F1  A9 1C
        sta $84               ; 90F3  85 84
        jsr cut_tiles         ; 90F5  20 FB 92
        lda verb_tmp1         ; 90F8  AD 57 0A
        beq L911B             ; 90FB  F0 1E
L90FD:    ; <- 90EF
        jsr print_inline      ; 90FD  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$57,$41,$4E,$44,$20,$43,$55,$54,$53,$20; 9100  I.THE WAND CUTS 
        .byte $53,$57,$49,$46,$54,$4C,$59,$FF         ; 9110  SWIFTLY.
        jmp jt_verb_done      ; 9118  4C 12 AC
L911B:    ; <- 90FB
        jsr print_inline      ; 911B  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$57,$41,$4E,$44,$20,$49,$53,$20,$55,$53; 911E  I.THE WAND IS US
        .byte $45,$4C,$45,$53,$53,$20,$48,$45,$52,$45,$FF; 912E  ELESS HERE.
        jmp jt_verb_done      ; 9139  4C 12 AC
L913C:    ; <- 90EA
        cmp #$09              ; 913C  C9 09
        beq L9143             ; 913E  F0 03
        jmp L91C7             ; 9140  4C C7 91
L9143:    ; <- 913E
        lda #$1C              ; 9143  A9 1C
        sta $84               ; 9145  85 84
        jsr cut_tiles         ; 9147  20 FB 92
        lda verb_tmp1         ; 914A  AD 57 0A
        beq L9173             ; 914D  F0 24
        jsr rnd               ; 914F  20 39 80
        cmp #$F0              ; 9152  C9 F0
        bcs L9194             ; 9154  B0 3E
        jsr print_inline      ; 9156  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$42,$45,$41,$4B,$20,$43,$55,$54,$53,$20; 9159  I.THE BEAK CUTS 
        .byte $53,$4C,$4F,$57,$4C,$59,$FF             ; 9169  SLOWLY.
        jmp jt_verb_done      ; 9170  4C 12 AC
L9173:    ; <- 914D
        jsr print_inline      ; 9173  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$42,$45,$41,$4B,$20,$49,$53,$20,$55,$53; 9176  I.THE BEAK IS US
        .byte $45,$4C,$45,$53,$53,$20,$48,$45,$52,$45,$FF; 9186  ELESS HERE.
        jmp jt_verb_done      ; 9191  4C 12 AC
L9194:    ; <- 9154
        lda #$00              ; 9194  A9 00
        ldx pick_index        ; 9196  AE 54 0A
        sta obj_flags,x       ; 9199  9D 00 0F
        jsr print_inline      ; 919C  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$54,$52,$45,$4E,$43,$48,$45,$52,$20,$42; 919F  I.THE TRENCHER B
        .byte $45,$41,$4B,$20,$42,$52,$45,$41,$4B,$53,$FF; 91AF  EAK BREAKS.
        ldx #$07              ; 91BA  A2 07
        jsr jt_sfx            ; 91BC  20 06 A8
        ldx #$FF              ; 91BF  A2 FF
        jsr L803C             ; 91C1  20 3C 80
        jmp L921A             ; 91C4  4C 1A 92
L91C7:    ; <- 9140
        cmp #$0B              ; 91C7  C9 0B
        beq L91CE             ; 91C9  F0 03
        jmp L9272             ; 91CB  4C 72 92
L91CE:    ; <- 91C9
        lda #$00              ; 91CE  A9 00
        sta verb_tmp0         ; 91D0  8D 56 0A
        lda #$01              ; 91D3  A9 01
        sta $84               ; 91D5  85 84
        lda player_col        ; 91D7  AD 10 0A
        jsr rope_span_probe   ; 91DA  20 22 92
        lda verb_tmp1         ; 91DD  AD 57 0A
        bne L9203             ; 91E0  D0 21
        jsr print_inline      ; 91E2  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$52,$4F,$50,$45,$20,$49,$53,$20,$55,$53; 91E5  I.THE ROPE IS US
        .byte $45,$4C,$45,$53,$53,$20,$48,$45,$52,$45,$FF; 91F5  ELESS HERE.
        jmp jt_verb_done      ; 9200  4C 12 AC
L9203:    ; <- 91E0
        lda #$E0              ; 9203  A9 E0
        sta verb_tmp0         ; 9205  8D 56 0A
        lda #$00              ; 9208  A9 00
        sta $84               ; 920A  85 84
        lda player_col        ; 920C  AD 10 0A
        jsr rope_span         ; 920F  20 26 92
        lda #$00              ; 9212  A9 00
        ldx pick_index        ; 9214  AE 54 0A
        sta obj_flags,x       ; 9217  9D 00 0F
L921A:    ; <- 91C4
        ldy #$0B              ; 921A  A0 0B
        jsr jt_subtract_weight; 921C  20 0C AC
        jmp jt_verb_done      ; 921F  4C 12 AC
rope_span_probe:    ; <- 91DA
        clc                   ; 9222  18
        adc facing            ; 9223  6D 37 0A
rope_span:    ; <- 920F
        clc                   ; 9226  18
        adc facing            ; 9227  6D 37 0A
        sta $9E               ; 922A  85 9E
        ldx player_row        ; 922C  AE 18 0A
        inx                   ; 922F  E8
        stx $9F               ; 9230  86 9F
        lda #$00              ; 9232  A9 00
        sta verb_tmp1         ; 9234  8D 57 0A
L9237:    ; <- 9269
        ldx $9E               ; 9237  A6 9E
        bmi L926C             ; 9239  30 31
        cpx #$28              ; 923B  E0 28
        bcs L926C             ; 923D  B0 2D
        ldy $9F               ; 923F  A4 9F
        jsr jt_read_tile      ; 9241  20 06 9C
        beq L924A             ; 9244  F0 04
        lda $84               ; 9246  A5 84
        bne L926B             ; 9248  D0 21
L924A:    ; <- 9244
        ldy #$00              ; 924A  A0 00
        lda verb_tmp0         ; 924C  AD 56 0A
        sta ($8C),y           ; 924F  91 8C
        lda $8D               ; 9251  A5 8D
        clc                   ; 9253  18
        adc #$18              ; 9254  69 18
        sta $8D               ; 9256  85 8D
        lda #$08              ; 9258  A9 08
        sta ($8C),y           ; 925A  91 8C
        lda $9E               ; 925C  A5 9E
        clc                   ; 925E  18
        adc facing            ; 925F  6D 37 0A
        sta $9E               ; 9262  85 9E
        inc verb_tmp1         ; 9264  EE 57 0A
        inc $84               ; 9267  E6 84
        bne L9237             ; 9269  D0 CC
L926B:    ; <- 9248
        rts                   ; 926B  60
L926C:    ; <- 9239 923D
        lda #$00              ; 926C  A9 00
        sta verb_tmp1         ; 926E  8D 57 0A
        rts                   ; 9271  60
L9272:    ; <- 91CB
        cmp #$0C              ; 9272  C9 0C
        bne L92B2             ; 9274  D0 3C
        lda room_lo           ; 9276  A5 86
        cmp #$4A              ; 9278  C9 4A
        bne L9280             ; 927A  D0 04
        lda room_hi           ; 927C  A5 87
        beq L9292             ; 927E  F0 12
L9280:    ; <- 927A
        lda #$08              ; 9280  A9 08
        sta $84               ; 9282  85 84
        jsr cut_tiles         ; 9284  20 FB 92
        lda verb_tmp1         ; 9287  AD 57 0A
        beq L9292             ; 928A  F0 06
        jsr jt_play_random_tune; 928C  20 12 3C
        jmp jt_verb_done      ; 928F  4C 12 AC
L9292:    ; <- 927E 928A 92B6 92BA 92C6
        jsr print_inline      ; 9292  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$4B,$45,$59,$20,$49,$53,$20,$55,$53,$45; 9295  I.THE KEY IS USE
        .byte $4C,$45,$53,$53,$20,$48,$45,$52,$45,$FF ; 92A5  LESS HERE.
        jmp jt_verb_done      ; 92AF  4C 12 AC
L92B2:    ; <- 9274
        lda room_lo           ; 92B2  A5 86
        cmp #$4A              ; 92B4  C9 4A
        bne L9292             ; 92B6  D0 DA
        lda room_hi           ; 92B8  A5 87
        bne L9292             ; 92BA  D0 D6
        lda #$08              ; 92BC  A9 08
        sta $84               ; 92BE  85 84
        jsr cut_tiles         ; 92C0  20 FB 92
        lda verb_tmp1         ; 92C3  AD 57 0A
        beq L9292             ; 92C6  F0 CA
        lda facing            ; 92C8  AD 37 0A
        bmi L92F8             ; 92CB  30 2B
        jsr print_inline      ; 92CD  20 09 80
        .byte $49,$C3,$45,$4E,$54,$45,$52,$20,$54,$48,$45,$20,$43,$48,$41,$4D; 92D0  I.ENTER THE CHAM
        .byte $42,$45,$52,$20,$4F,$46,$20,$54,$48,$45,$20,$46,$4F,$52,$47,$4F; 92E0  BER OF THE FORGO
        .byte $54,$54,$45,$4E,$FF                     ; 92F0  TTEN.
        jsr jt_play_random_tune; 92F5  20 12 3C
L92F8:    ; <- 92CB
        jmp jt_verb_done      ; 92F8  4C 12 AC
; cut every tile equal to $84 in the 5 cells above the player and above the cell in front; count in $0A57
cut_tiles:    ; <- 90F5 9147 9284 92C0
        lda player_col        ; 92FB  AD 10 0A
        clc                   ; 92FE  18
        adc facing            ; 92FF  6D 37 0A
        sta $9E               ; 9302  85 9E
        lda player_row        ; 9304  AD 18 0A
        sta $9F               ; 9307  85 9F
        lda #$00              ; 9309  A9 00
        sta verb_tmp1         ; 930B  8D 57 0A
        jsr cut_tile_column   ; 930E  20 1B 93
        lda player_col        ; 9311  AD 10 0A
        sta $9E               ; 9314  85 9E
        lda player_row        ; 9316  AD 18 0A
        sta $9F               ; 9319  85 9F
cut_tile_column:    ; <- 930E
        lda #$05              ; 931B  A9 05
        sta verb_tmp0         ; 931D  8D 56 0A
L9320:    ; <- 9337
        ldx $9E               ; 9320  A6 9E
        ldy $9F               ; 9322  A4 9F
        jsr jt_read_tile      ; 9324  20 06 9C
        cmp $84               ; 9327  C5 84
        bne L9332             ; 9329  D0 07
        lda #$00              ; 932B  A9 00
        sta ($8C),y           ; 932D  91 8C
        inc verb_tmp1         ; 932F  EE 57 0A
L9332:    ; <- 9329
        dec $9F               ; 9332  C6 9F
        dec verb_tmp0         ; 9334  CE 56 0A
        bne L9320             ; 9337  D0 E7
        rts                   ; 9339  60
; wand of befal: freeze the adjacent creature, at the cost of $0A67
wand_of_befal_hit:    ; <- 90EC
        ldx blk_npc_id        ; 933A  AE F0 09
        beq L93BA             ; 933D  F0 7B
        lda npc_banished,x    ; 933F  BD 00 23
        bit bit7_mask         ; 9342  2C A7 0A
        bne L93BA             ; 9345  D0 73
        lda player_col        ; 9347  AD 10 0A
        cmp npc_col           ; 934A  CD 80 0A
        beq L9361             ; 934D  F0 12
        clc                   ; 934F  18
        adc facing            ; 9350  6D 37 0A
        cmp npc_col           ; 9353  CD 80 0A
        beq L9361             ; 9356  F0 09
        clc                   ; 9358  18
        adc facing            ; 9359  6D 37 0A
        cmp npc_col           ; 935C  CD 80 0A
        bne L93BA             ; 935F  D0 59
L9361:    ; <- 934D 9356
        ldy player_row        ; 9361  AC 18 0A
        cpy npc_row           ; 9364  CC 81 0A
        beq L9376             ; 9367  F0 0D
        dey                   ; 9369  88
        cpy npc_row           ; 936A  CC 81 0A
        beq L9376             ; 936D  F0 07
        iny                   ; 936F  C8
        iny                   ; 9370  C8
        cpy npc_row           ; 9371  CC 81 0A
        bne L93BA             ; 9374  D0 44
L9376:    ; <- 9367 936D
        lda npc_banished,x    ; 9376  BD 00 23
        ora #$80              ; 9379  09 80
        sta npc_banished,x    ; 937B  9D 00 23
        lda #$03              ; 937E  A9 03
        sta $D015             ; 9380  8D 15 D0
        ldx #$01              ; 9383  A2 01
        jsr jt_sfx            ; 9385  20 06 A8
        ldy #$01              ; 9388  A0 01
        lda npc_species       ; 938A  AD 84 0A
        cmp #$0A              ; 938D  C9 0A
        beq L9395             ; 938F  F0 04
        cmp #$06              ; 9391  C9 06
        bcs L9397             ; 9393  B0 02
L9395:    ; <- 938F
        ldy #$05              ; 9395  A0 05
L9397:    ; <- 9393
        sty $80               ; 9397  84 80
        lda spirit_limit      ; 9399  AD 67 0A
        sec                   ; 939C  38
        sbc $80               ; 939D  E5 80
        bcs L93A3             ; 939F  B0 02
        lda #$00              ; 93A1  A9 00
L93A3:    ; <- 939F
        sta spirit_limit      ; 93A3  8D 67 0A
        lda #$00              ; 93A6  A9 00
        sta spirit_energy     ; 93A8  8D 63 0A
        lda #$00              ; 93AB  A9 00
        sta npc_active        ; 93AD  8D 82 0A
        lda #$32              ; 93B0  A9 32
        sta npc_col           ; 93B2  8D 80 0A
        sta npc_row           ; 93B5  8D 81 0A
        sec                   ; 93B8  38
        rts                   ; 93B9  60
L93BA:    ; <- 933D 9345 935F 9374
        clc                   ; 93BA  18
        rts                   ; 93BB  60
        .byte $60,$00,$00,$00                         ; 93BC  `...
demo_finished:    ; <- 958B
        ldx #$00              ; 93C0* A2 00
        stx demo_next_room    ; 93C2* 8E 96 0A
        cmp #$FF              ; 93C5* C9 FF
        bne L93CC             ; 93C7* D0 03
L93C9:    ; <- 93DA
        jmp jt_main_menu      ; 93C9* 4C 00 34
L93CC:    ; <- 93C7
        cmp #$9D              ; 93CC* C9 9D
        bne L93D6             ; 93CE* D0 06
        jsr attract_intro_setup; 93D0  20 89 97
        jmp game_loop         ; 93D3  4C 4F 95
L93D6:    ; <- 93CE
        lda attract_state     ; 93D6* A5 D8
        cmp #$01              ; 93D8* C9 01
        beq L93C9             ; 93DA* F0 ED
        jsr attract_quest_setup; 93DC  20 C4 97
        jmp game_loop         ; 93DF  4C 4F 95
clear_room_rows:    ; <- 940B 9456 9503 967D
        lda #$C0              ; 93E2* A9 C0
        sta $89               ; 93E4* 85 89
        lda #$D8              ; 93E6* A9 D8
        sta $8B               ; 93E8* 85 8B
        lda #$00              ; 93EA* A9 00
        sta $88               ; 93EC* 85 88
        sta $8A               ; 93EE* 85 8A
        tay                   ; 93F0* A8
        ldx #$03              ; 93F1* A2 03
L93F3:    ; <- 93F8 93FF
        sta ($88),y           ; 93F3* 91 88
        sta ($8A),y           ; 93F5* 91 8A
        iny                   ; 93F7* C8
        bne L93F3             ; 93F8* D0 F9
        inc $89               ; 93FA* E6 89
        inc $8B               ; 93FC* E6 8B
        dex                   ; 93FE* CA
        bne L93F3             ; 93FF* D0 F2
L9401:    ; <- 9408
        sta ($88),y           ; 9401* 91 88
        sta ($8A),y           ; 9403* 91 8A
        iny                   ; 9405* C8
        cpy #$20              ; 9406* C0 20
        bne L9401             ; 9408* D0 F7
        rts                   ; 940A* 60
clear_screen:    ; <- 9509
        jsr clear_room_rows   ; 940B* 20 E2 93
clear_text_area:    ; <- 945D 9506 9534
        lda #$00              ; 940E* A9 00
        sta $88               ; 9410* 85 88
        ldy #$C3              ; 9412* A0 C3
        sty $89               ; 9414* 84 89
        ldy #$20              ; 9416* A0 20
L9418:    ; <- 941D
        sta ($88),y           ; 9418* 91 88
        iny                   ; 941A* C8
        cpy #$F8              ; 941B* C0 F8
        bne L9418             ; 941D* D0 F9
        rts                   ; 941F* 60
select_tileset:    ; <- 950C
        lda #$00              ; 9420* A9 00
        sta D0A48             ; 9422* 8D 48 0A
        lda room_hi           ; 9425* A5 87
        beq L9434             ; 9427* F0 0B
        lda room_lo           ; 9429  A5 86
        cmp #$80              ; 942B  C9 80
        bcc L9434             ; 942D  90 05
L942F:    ; <- 9449
        inc D0A48             ; 942F* EE 48 0A
        bne L944B             ; 9432* D0 17
L9434:    ; <- 9427 942D
        lda room_lo           ; 9434* A5 86
        cmp #$9D              ; 9436* C9 9D
        beq L944B             ; 9438* F0 11
        cmp #$9E              ; 943A* C9 9E
        beq L944B             ; 943C* F0 0D
        cmp #$7D              ; 943E* C9 7D
        beq L944B             ; 9440* F0 09
        cmp #$7E              ; 9442* C9 7E
        beq L944B             ; 9444* F0 05
        jsr jt_room_is_outdoor; 9446* 20 00 A6
        beq L942F             ; 9449* F0 E4
L944B:    ; <- 9432 9438 943C 9440 9444
        lda D0A48             ; 944B* AD 48 0A
        cmp tileset_shown     ; 944E* CD 0F 0A
        beq L945C             ; 9451* F0 09
        sta tileset_shown     ; 9453* 8D 0F 0A
        jsr clear_room_rows   ; 9456* 20 E2 93
        jsr jt_swap_charset_banks; 9459* 20 0C 9C
L945C:    ; <- 9451
        rts                   ; 945C* 60
L945D:    ; <- 95B0
        jsr clear_text_area   ; 945D  20 0E 94
        lda #$04              ; 9460  A9 04
        sta D0A4B             ; 9462  8D 4B 0A
        jsr print_inline      ; 9465  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$53,$50,$49,$52,$49,$54,$20,$42,$45,$4C; 9468  I.THE SPIRIT BEL
        .byte $4C,$20,$52,$49,$4E,$47,$53,$FF         ; 9478  L RINGS.
        jsr jt_verb_done      ; 9480  20 12 AC
        lda #$00              ; 9483  A9 00
        sta spirit_bell_rang  ; 9485  85 DF
        jmp L955C             ; 9487  4C 5C 95
recover_a_day:    ; <- 95A9
        jsr jt_return_home    ; 948A  20 03 A6
        lda #$04              ; 948D  A9 04
        sta D0A4B             ; 948F  8D 4B 0A
recover_day_msg:
        jsr print_inline      ; 9492  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$53,$50,$45,$4E,$54,$20,$41,$20,$44,$41; 9495  I.YOU SPENT A DA
        .byte $59,$20,$52,$45,$43,$4F,$56,$45,$52,$49,$4E,$47,$FF; 94A5  Y RECOVERING.
        jsr print_inline      ; 94B2  20 09 80
        .byte $71,$C3,$46,$52,$4F,$4D,$20,$41,$20,$4C,$41,$43,$4B,$20,$4F,$46; 94B5  q.FROM A LACK OF
        .byte $FF                                     ; 94C5  .
        lda fatigue_cause     ; 94C6  A5 C4
        cmp #$01              ; 94C8  C9 01
        bne L94D9             ; 94CA  D0 0D
        jsr print_inline      ; 94CC  20 09 80
        .byte $80,$C3,$46,$4F,$4F,$44,$FF             ; 94CF  ..FOOD.
        jmp L94E3             ; 94D6  4C E3 94
L94D9:    ; <- 94CA
        jsr print_inline      ; 94D9  20 09 80
        .byte $80,$C3,$52,$45,$53,$54,$FF             ; 94DC  ..REST.
L94E3:    ; <- 94D6
        lda #$00              ; 94E3  A9 00
        sta fatigue_cause     ; 94E5  85 C4
        jsr jt_verb_done      ; 94E7  20 12 AC
        jmp L955C             ; 94EA  4C 5C 95
        .byte $20,$4F,$46,$FF,$A5,$C4,$C9,$01,$D0,$0D,$20,$09,$80,$80,$C3,$46; 94ED   OF....... ....F
        .byte $4F,$4F,$44                             ; 94FD  OOD
L9500:    ; <- 3419 3A35
        jmp attract_start     ; 9500* 4C 2B 95
jt_clear_room_rows:
        jmp clear_room_rows   ; 9503  4C E2 93
jt_clear_text_rows:    ; <- 2C04 3427 34A0 3673 36AE 370D 3842 38B2 38BC 3915 395E 3AA1 3AD7 3B59 3C48 407B 4194 4234 42C1 43CC 4462 8321 835C 84B5 8510 85B8 85FB 86A0 8768 9000 9086 9E17 9EB6 A326 A64C A7BE A8A2 A928 AC15 ACD1 ACDE AD2B AD52 AE41 AF56 AFB5 B11E B122 B40C B49C B653
        jmp clear_text_area   ; 9506* 4C 0E 94
jt_clear_screen:    ; <- 880C 89A1
        jmp clear_screen      ; 9509* 4C 0B 94
L950C:    ; <- 8BCE
        jmp select_tileset    ; 950C* 4C 20 94
L950F:    ; <- 36C6
        jmp reset_object_table; 950F* 4C BB 97
L9512:    ; <- 3730
        jmp load_room         ; 9512  4C 4A 96
jt_run_new_game:    ; <- 3703
        jmp game_loop         ; 9515* 4C 4F 95
jt_resume_game:    ; <- 3733
        jmp game_loop_resume  ; 9518  4C 32 96
L951B:    ; <- 9578
        lda #$04              ; 951B* A9 04
        sta D0A4B             ; 951D* 8D 4B 0A
        jsr jt_tool_menu      ; 9520* 20 00 A8
        lda #$00              ; 9523  A9 00
        sta menu_req          ; 9525  8D 4A 0A
        jmp L955C             ; 9528  4C 5C 95
attract_start:    ; <- 9500
        jsr L9750             ; 952B* 20 50 97
        lda $02               ; 952E* A5 02
        cmp #$0D              ; 9530* C9 0D
        bne game_loop         ; 9532* D0 1B
        jsr clear_text_area   ; 9534* 20 0E 94
        lda #$01              ; 9537* A9 01
        sta demo_flag         ; 9539* 8D 92 0A
        jsr jt_set_panel_color; 953C* 20 03 A8
        lda attract_state     ; 953F* A5 D8
        bpl L954C             ; 9541* 10 09
        jsr attract_quest_setup; 9543  20 C4 97
        jsr L9750             ; 9546  20 50 97
        jmp game_loop         ; 9549  4C 4F 95
L954C:    ; <- 9541
        jsr attract_intro_setup; 954C* 20 89 97
game_loop:    ; <- 93D3 93DF 9515 9532 9549
        jsr L9761             ; 954F* 20 61 97
        lda #$00              ; 9552* A9 00
        sta step_counter      ; 9554* 8D 08 0A
        lda #$08              ; 9557* A9 08
        sta step_period       ; 9559* 8D 06 0A
L955C:    ; <- 9487 94EA 9528 959B 95B6 96EE 974A
        lda #$01              ; 955C* A9 01
        sta game_active       ; 955E* 8D 04 0A
game_loop_tick:    ; <- 9564 9583 9647
        lda game_active       ; 9561* AD 04 0A
        bne game_loop_tick    ; 9564* D0 FB
        lda exit_dir          ; 9566* AD 05 0A
        bne room_edge_load    ; 9569* D0 4E
        lda door_req          ; 956B* AD 0D 0A
        beq L9573             ; 956E* F0 03
        jmp L9681             ; 9570  4C 81 96
L9573:    ; <- 956E
        lda menu_req          ; 9573* AD 4A 0A
        beq L957B             ; 9576* F0 03
        jmp L951B             ; 9578* 4C 1B 95
L957B:    ; <- 9576
        lda drowned           ; 957B* AD 4D 0A
        beq L9586             ; 957E* F0 06
        jsr jt_drowned        ; 9580  20 06 A6
        jmp game_loop_tick    ; 9583  4C 61 95
L9586:    ; <- 957E
        lda demo_next_room    ; 9586* AD 96 0A
        beq L958E             ; 9589* F0 03
        jmp demo_finished     ; 958B* 4C C0 93
L958E:    ; <- 9589
        lda demo_text_req     ; 958E* AD 97 0A
        beq L959E             ; 9591* F0 0B
        jsr demo_text_page    ; 9593* 20 00 2C
        lda #$00              ; 9596* A9 00
        sta demo_text_req     ; 9598* 8D 97 0A
        jmp L955C             ; 959B* 4C 5C 95
L959E:    ; <- 9591
        lda quest_time_up     ; 959E  A5 DE
        beq L95A5             ; 95A0  F0 03
        jmp quest_time_over   ; 95A2  4C 76 8E
L95A5:    ; <- 95A0
        lda fatigue_cause     ; 95A5  A5 C4
        beq L95AC             ; 95A7  F0 03
        jmp recover_a_day     ; 95A9  4C 8A 94
L95AC:    ; <- 95A7
        lda spirit_bell_rang  ; 95AC  A5 DF
        beq L95B3             ; 95AE  F0 03
        jmp L945D             ; 95B0  4C 5D 94
L95B3:    ; <- 95AE
        jsr LA815             ; 95B3  20 15 A8
        jmp L955C             ; 95B6  4C 5C 95
room_edge_load:    ; <- 9569
        lda exit_dir          ; 95B9* AD 05 0A
        cmp #$01              ; 95BC* C9 01
        bne L95D6             ; 95BE* D0 16
        sec                   ; 95C0* 38
        lda room_lo           ; 95C1* A5 86
        sbc #$20              ; 95C3* E9 20
        sta room_lo           ; 95C5* 85 86
        bcs L95CB             ; 95C7* B0 02
        dec room_hi           ; 95C9  C6 87
L95CB:    ; <- 95C7
        jsr load_room         ; 95CB* 20 4A 96
        lda #$12              ; 95CE* A9 12
        sta player_row        ; 95D0* 8D 18 0A
        jmp game_loop_resume  ; 95D3* 4C 32 96
L95D6:    ; <- 95BE
        cmp #$02              ; 95D6* C9 02
        bne L95FB             ; 95D8* D0 21
        lda room_lo           ; 95DA* A5 86
        and #$1F              ; 95DC* 29 1F
        cmp #$1F              ; 95DE* C9 1F
        bne L95EB             ; 95E0* D0 09
        lda room_lo           ; 95E2  A5 86
        and #$E0              ; 95E4  29 E0
        sta room_lo           ; 95E6  85 86
        jmp L95ED             ; 95E8  4C ED 95
L95EB:    ; <- 95E0
        inc room_lo           ; 95EB* E6 86
L95ED:    ; <- 95E8
        jsr load_room         ; 95ED* 20 4A 96
        lda #$00              ; 95F0* A9 00
        sta player_col        ; 95F2* 8D 10 0A
        sta last_col          ; 95F5* 8D 0B 0A
        jmp game_loop_resume  ; 95F8* 4C 32 96
L95FB:    ; <- 95D8
        cmp #$03              ; 95FB* C9 03
        bne L9615             ; 95FD* D0 16
        clc                   ; 95FF* 18
        lda room_lo           ; 9600* A5 86
        adc #$20              ; 9602* 69 20
        sta room_lo           ; 9604* 85 86
        bcc L960A             ; 9606* 90 02
        inc room_hi           ; 9608  E6 87
L960A:    ; <- 9606
        jsr load_room         ; 960A* 20 4A 96
        lda #$00              ; 960D* A9 00
        sta player_row        ; 960F* 8D 18 0A
        jmp game_loop_resume  ; 9612* 4C 32 96
L9615:    ; <- 95FD
        lda room_lo           ; 9615* A5 86
        and #$1F              ; 9617* 29 1F
        bne L9625             ; 9619* D0 0A
        clc                   ; 961B  18
        lda room_lo           ; 961C  A5 86
        adc #$1F              ; 961E  69 1F
        sta room_lo           ; 9620  85 86
        jmp L9627             ; 9622  4C 27 96
L9625:    ; <- 9619
        dec room_lo           ; 9625* C6 86
L9627:    ; <- 9622
        jsr load_room         ; 9627* 20 4A 96
        lda #$27              ; 962A* A9 27
        sta player_col        ; 962C* 8D 10 0A
        sta last_col          ; 962F* 8D 0B 0A
game_loop_resume:    ; <- 9518 95D3 95F8 9612
        lda #$00              ; 9632* A9 00
        sta exit_dir          ; 9634* 8D 05 0A
        jsr jt_move_sprite    ; 9637* 20 03 9C
        lda #$03              ; 963A* A9 03
        sta $D015             ; 963C* 8D 15 D0
        jsr jt_spawn_creature ; 963F* 20 03 98
        lda #$01              ; 9642* A9 01
        sta game_active       ; 9644* 8D 04 0A
        jmp game_loop_tick    ; 9647* 4C 61 95
; burn the honeylamp, then: indoor flag set -> load; else outdoor bit clear -> open air, no creature
load_room:    ; <- 9512 95CB 95ED 960A 9627 9796 97CF
        lda lamp_fuel         ; 964A* A5 CB
        beq L9662             ; 964C* F0 14
        dec lamp_fuel         ; 964E  C6 CB
        bne L9662             ; 9650  D0 10
        ldx lamp_index        ; 9652  A6 CA
        lda #$00              ; 9654  A9 00
        sta lamp_index        ; 9656  85 CA
        sta obj_flags,x       ; 9658  9D 00 0F
        txa                   ; 965B  8A
        jsr jt_object_class   ; 965C  20 09 AC
        jsr jt_subtract_weight; 965F  20 0C AC
L9662:    ; <- 964C 9650
        lda #$00              ; 9662* A9 00
        sta $D015             ; 9664* 8D 15 D0
        lda indoor_flag       ; 9667* AD 0E 0A
        bne L9671             ; 966A* D0 05
        jsr jt_room_is_outdoor; 966C  20 00 A6
        beq load_room_air     ; 966F  F0 04
L9671:    ; <- 966A
        jsr L8803             ; 9671* 20 03 88
        rts                   ; 9674* 60
load_room_air:    ; <- 966F
        lda #$00              ; 9675  A9 00
        sta blk_creature      ; 9677  8D E0 09
        jsr jt_spawn_creature ; 967A  20 03 98
        jsr clear_room_rows   ; 967D  20 E2 93
        rts                   ; 9680  60
L9681:    ; <- 9570
        lda dream_state       ; 9681  A5 C8
        beq door_lock_check   ; 9683  F0 34
        bmi L96A1             ; 9685  30 1A
        lda #$BE              ; 9687  A9 BE
        sta room_lo           ; 9689  85 86
        lda #$12              ; 968B  A9 12
        sta player_col        ; 968D  8D 10 0A
        lda #$0E              ; 9690  A9 0E
        sta player_row        ; 9692  8D 18 0A
        lda #$00              ; 9695  A9 00
        sta indoor_flag       ; 9697  8D 0E 0A
        lda #$FF              ; 969A  A9 FF
        sta dream_state       ; 969C  85 C8
        jmp L9720             ; 969E  4C 20 97
L96A1:    ; <- 9685
        lda #$09              ; 96A1  A9 09
        sta room_lo           ; 96A3  85 86
        lda #$18              ; 96A5  A9 18
        sta player_col        ; 96A7  8D 10 0A
        lda #$0D              ; 96AA  A9 0D
        sta player_row        ; 96AC  8D 18 0A
        lda #$00              ; 96AF  A9 00
        sta indoor_flag       ; 96B1  8D 0E 0A
        sta dream_state       ; 96B4  85 C8
        jmp L9720             ; 96B6  4C 20 97
door_lock_check:    ; <- 9683
        lda blk_npc_kind      ; 96B9  AD F1 09
        cmp #$C0              ; 96BC  C9 C0
        bne L96F1             ; 96BE  D0 31
        lda gate_a_open       ; 96C0  AD 34 23
        bne enter_door        ; 96C3  D0 35
L96C5:    ; <- 96F8
        lda door_permission   ; 96C5  A5 CD
        bne enter_door        ; 96C7  D0 31
        lda #$04              ; 96C9  A9 04
        sta D0A4B             ; 96CB  8D 4B 0A
        jsr print_inline      ; 96CE  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$44,$4F,$4F,$52,$20,$49,$53,$20,$4C,$4F; 96D1  I.THE DOOR IS LO
        .byte $43,$4B,$45,$44,$FF                     ; 96E1  CKED.
        jsr jt_verb_done      ; 96E6  20 12 AC
        lda #$00              ; 96E9  A9 00
        sta door_req          ; 96EB  8D 0D 0A
        jmp L955C             ; 96EE  4C 5C 95
L96F1:    ; <- 96BE
        cmp #$C1              ; 96F1  C9 C1
        bne enter_door        ; 96F3  D0 05
        lda gate_b_open       ; 96F5  AD 35 23
        beq L96C5             ; 96F8  F0 CB
enter_door:    ; <- 96C3 96C7 96F3
        ldy door_req          ; 96FA  AC 0D 0A
        ldx L974A+2,y         ; 96FD  BE 4C 97
        lda blk_buf,x         ; 9700  BD 00 09
        sta room_lo           ; 9703  85 86
        ldy #$00              ; 9705  A0 00
        lda D0901,x           ; 9707  BD 01 09
        pha                   ; 970A  48
        and #$80              ; 970B  29 80
        beq L9710             ; 970D  F0 01
        iny                   ; 970F  C8
L9710:    ; <- 970D
        sty room_hi           ; 9710  84 87
        pla                   ; 9712  68
        and #$7F              ; 9713  29 7F
        sta player_col        ; 9715  8D 10 0A
        lda D0902,x           ; 9718  BD 02 09
        and #$7F              ; 971B  29 7F
        sta player_row        ; 971D  8D 18 0A
L9720:    ; <- 969E 96B6
        jsr L8803             ; 9720  20 03 88
        lda #$00              ; 9723  A9 00
        sec                   ; 9725  38
        sbc facing            ; 9726  ED 37 0A
        sta facing            ; 9729  8D 37 0A
        jsr jt_draw_player    ; 972C  20 0F 9C
        jsr jt_move_sprite    ; 972F  20 03 9C
        lda #$03              ; 9732  A9 03
        sta $D015             ; 9734  8D 15 D0
        jsr jt_spawn_creature ; 9737  20 03 98
        lda #$00              ; 973A  A9 00
        sta door_req          ; 973C  8D 0D 0A
        lda indoor_flag       ; 973F  AD 0E 0A
        eor #$01              ; 9742  49 01
        sta indoor_flag       ; 9744  8D 0E 0A
        jsr L8E60             ; 9747  20 60 8E
        jmp L955C             ; 974A  4C 5C 95
door_offsets:
        .byte $F2,$F5,$F8                             ; 974D  ...
L9750:    ; <- 952B 9546 97B8
        jsr reset_object_table; 9750* 20 BB 97
        lda #$23              ; 9753* A9 23
        ldx #$01              ; 9755* A2 01
        jsr jt_memclr_pages   ; 9757* 20 33 80
        lda #$FF              ; 975A* A9 FF
        sta fatigue           ; 975C* 85 C5
        jmp jt_init_character ; 975E* 4C 15 9C
L9761:    ; <- 954F
        lda #$01              ; 9761* A9 01
        sta $D027             ; 9763* 8D 27 D0
        sta $D028             ; 9766* 8D 28 D0
        lda $D015             ; 9769* AD 15 D0
        ora #$03              ; 976C* 09 03
        sta $D015             ; 976E* 8D 15 D0
        jsr jt_draw_player    ; 9771* 20 0F 9C
        lda D0A17             ; 9774* AD 17 0A
        sta player_col        ; 9777* 8D 10 0A
        lda D0A1F             ; 977A* AD 1F 0A
        sta player_row        ; 977D* 8D 18 0A
        jsr jt_move_sprite    ; 9780* 20 03 9C
        lda #$00              ; 9783* A9 00
        sta step_counter      ; 9785* 8D 08 0A
        rts                   ; 9788* 60
attract_intro_setup:    ; <- 93D0 954C
        lda #$9D              ; 9789* A9 9D
        sta room_lo           ; 978B* 85 86
        lda #$00              ; 978D* A9 00
        sta room_hi           ; 978F* 85 87
        lda #$01              ; 9791* A9 01
        sta indoor_flag       ; 9793* 8D 0E 0A
        jsr load_room         ; 9796* 20 4A 96
        lda #$00              ; 9799* A9 00
        sta demo_ptr          ; 979B* 85 A9
        lda #$2F              ; 979D* A9 2F
        sta $AA               ; 979F* 85 AA
        lda #$06              ; 97A1* A9 06
        sta D0A17             ; 97A3* 8D 17 0A
        lda #$0E              ; 97A6* A9 0E
        sta D0A1F             ; 97A8* 8D 1F 0A
        lda #$01              ; 97AB* A9 01
        sta crawling          ; 97AD* 8D 3D 0A
        sta demo_steps        ; 97B0* 8D 90 0A
        lda #$FF              ; 97B3* A9 FF
        sta facing            ; 97B5* 8D 37 0A
        jmp L9750             ; 97B8* 4C 50 97
reset_object_table:    ; <- 950F 9750
        lda #$C4              ; 97BB* A9 C4
        ldy #$0D              ; 97BD* A0 0D
        ldx #$03              ; 97BF* A2 03
        jmp jt_memcpy_pages   ; 97C1* 4C 30 80
attract_quest_setup:    ; <- 93DC 9543
        lda #$E4              ; 97C4  A9 E4
        sta room_lo           ; 97C6  85 86
        lda #$00              ; 97C8  A9 00
        sta room_hi           ; 97CA  85 87
        sta indoor_flag       ; 97CC  8D 0E 0A
        jsr load_room         ; 97CF  20 4A 96
        lda #$00              ; 97D2  A9 00
        sta demo_ptr          ; 97D4  85 A9
        lda #$31              ; 97D6  A9 31
        sta $AA               ; 97D8  85 AA
        lda #$18              ; 97DA  A9 18
        sta D0A17             ; 97DC  8D 17 0A
        lda #$0E              ; 97DF  A9 0E
        sta D0A1F             ; 97E1  8D 1F 0A
        lda #$01              ; 97E4  A9 01
        sta demo_steps        ; 97E6  8D 90 0A
        lda #$FF              ; 97E9  A9 FF
        sta facing            ; 97EB  8D 37 0A
        rts                   ; 97EE  60
        .byte $37,$0A,$60,$95,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 97EF  7.`.............
        .byte $00                                     ; 97FF  .
L9800:    ; <- 899E
        jmp L9809             ; 9800  4C 09 98
jt_spawn_creature:    ; <- 963F 967A 9737
        jmp spawn_creature    ; 9803* 4C 0A 98
jt_creature_step:    ; <- A01E
        jmp creature_step     ; 9806* 4C 71 99
L9809:    ; <- 9800
        rts                   ; 9809  60
; runs on every room entry; copies 384 bytes of sprites each time
spawn_creature:    ; <- 9803
        lda #$00              ; 980A* A9 00
        sta npc_active        ; 980C* 8D 82 0A
        lda $D015             ; 980F* AD 15 D0
        and #$F3              ; 9812* 29 F3
        sta $D015             ; 9814* 8D 15 D0
        lda #$32              ; 9817* A9 32
        sta npc_col           ; 9819* 8D 80 0A
        sta npc_row           ; 981C* 8D 81 0A
        ldx blk_npc_id        ; 981F* AE F0 09
        lda npc_banished,x    ; 9822* BD 00 23
        bit bit7_mask         ; 9825* 2C A7 0A
        beq L982B             ; 9828* F0 01
        rts                   ; 982A  60
L982B:    ; <- 9828
        lda blk_creature      ; 982B* AD E0 09
        bne L9831             ; 982E* D0 01
        rts                   ; 9830* 60
L9831:    ; <- 982E
        lda blk_npc_kind      ; 9831* AD F1 09
        and #$F0              ; 9834* 29 F0
        cmp #$E0              ; 9836* C9 E0
        bne L9857             ; 9838* D0 1D
        lda npc_flags,x       ; 983A  BD 80 23
        and #$1F              ; 983D  29 1F
        cmp time_of_day       ; 983F  CD 61 0A
        beq L9857             ; 9842  F0 13
        jsr rnd               ; 9844  20 39 80
        and #$03              ; 9847  29 03
        beq L984C             ; 9849  F0 01
        rts                   ; 984B  60
L984C:    ; <- 9849
        lda npc_flags,x       ; 984C  BD 80 23
        and #$E0              ; 984F  29 E0
        ora time_of_day       ; 9851  0D 61 0A
        sta npc_flags,x       ; 9854  9D 80 23
L9857:    ; <- 9838 9842
        lda blk_creature      ; 9857* AD E0 09
        pha                   ; 985A* 48
        and #$0F              ; 985B* 29 0F
        sta $D029             ; 985D* 8D 29 D0
        sta $D02A             ; 9860* 8D 2A D0
        pla                   ; 9863* 68
        lsr a                 ; 9864* 4A
        lsr a                 ; 9865* 4A
        lsr a                 ; 9866* 4A
        lsr a                 ; 9867* 4A
        sta npc_species       ; 9868* 8D 84 0A
        tax                   ; 986B* AA
        lda species_sprite_lo,x; 986C* BD 4F 99
        sta $80               ; 986F* 85 80
        lda species_sprite_hi,x; 9871* BD 5A 99
        sta $81               ; 9874* 85 81
        lda #$00              ; 9876* A9 00
        sta $D01A             ; 9878* 8D 1A D0
        lda #$02              ; 987B* A9 02
        sta VIC_MEM           ; 987D* 8D 18 D0
        jsr L8015             ; 9880* 20 15 80
        lda #$02              ; 9883* A9 02
        sta $84               ; 9885* 85 84
; 3 x 128 bytes to $FD00, bit-reversed + column-swapped to $FE80
copy_species_sprites:    ; <- 98D9
        ldx $84               ; 9887* A6 84
        lda sprite_dst_lo,x   ; 9889* BD 65 99
        sta $82               ; 988C* 85 82
        lda sprite_dst_hi,x   ; 988E* BD 68 99
        sta $83               ; 9891* 85 83
        lda sprite_mirror_lo,x; 9893* BD 6B 99
        sta $9C               ; 9896* 85 9C
        lda sprite_mirror_hi,x; 9898* BD 6E 99
        sta $9D               ; 989B* 85 9D
        ldy #$7E              ; 989D* A0 7E
L989F:    ; <- 98B0
        ldx #$08              ; 989F* A2 08
        lda ($80),y           ; 98A1* B1 80
        sta ($82),y           ; 98A3* 91 82
L98A5:    ; <- 98A9
        asl a                 ; 98A5* 0A
        ror $85               ; 98A6* 66 85
        dex                   ; 98A8* CA
        bne L98A5             ; 98A9* D0 FA
        lda $85               ; 98AB* A5 85
        sta ($9C),y           ; 98AD* 91 9C
        dey                   ; 98AF* 88
        bpl L989F             ; 98B0* 10 ED
        ldy #$7E              ; 98B2* A0 7E
L98B4:    ; <- 98CA
        lda ($9C),y           ; 98B4* B1 9C
        pha                   ; 98B6* 48
        dey                   ; 98B7* 88
        dey                   ; 98B8* 88
        lda ($9C),y           ; 98B9* B1 9C
        iny                   ; 98BB* C8
        iny                   ; 98BC* C8
        sta ($9C),y           ; 98BD* 91 9C
        dey                   ; 98BF* 88
        dey                   ; 98C0* 88
        pla                   ; 98C1* 68
        sta ($9C),y           ; 98C2* 91 9C
        cpy #$40              ; 98C4* C0 40
        bne L98C9             ; 98C6* D0 01
        dey                   ; 98C8* 88
L98C9:    ; <- 98C6
        dey                   ; 98C9* 88
        bpl L98B4             ; 98CA* 10 E8
        clc                   ; 98CC* 18
        lda $80               ; 98CD* A5 80
        adc #$80              ; 98CF* 69 80
        bcc L98D5             ; 98D1* 90 02
        inc $81               ; 98D3* E6 81
L98D5:    ; <- 98D1
        sta $80               ; 98D5* 85 80
        dec $84               ; 98D7* C6 84
        bpl copy_species_sprites; 98D9* 10 AC
        jsr L8018             ; 98DB* 20 18 80
        jsr L8809             ; 98DE* 20 09 88
        lda blk_npc_col       ; 98E1* AD E3 09
        sta npc_col           ; 98E4* 8D 80 0A
        lda blk_npc_row       ; 98E7* AD E4 09
        sta npc_row           ; 98EA* 8D 81 0A
        lda blk_npc_spread    ; 98ED* AD E2 09
        pha                   ; 98F0* 48
        and #$0F              ; 98F1* 29 0F
        sta npc_gait          ; 98F3* 8D 83 0A
        pla                   ; 98F6* 68
        lsr a                 ; 98F7* 4A
        lsr a                 ; 98F8* 4A
        lsr a                 ; 98F9* 4A
        lsr a                 ; 98FA* 4A
        sta $84               ; 98FB* 85 84
L98FD:    ; <- 9904
        jsr rnd               ; 98FD* 20 39 80
        and #$1F              ; 9900* 29 1F
        cmp $84               ; 9902* C5 84
        bcs L98FD             ; 9904* B0 F7
        clc                   ; 9906* 18
        adc npc_col           ; 9907* 6D 80 0A
        sta npc_col           ; 990A* 8D 80 0A
        jsr rnd               ; 990D* 20 39 80
        and #$01              ; 9910* 29 01
        bne L9916             ; 9912* D0 02
        lda #$FF              ; 9914* A9 FF
L9916:    ; <- 9912
        sta npc_dir           ; 9916* 8D 85 0A
        jsr set_creature_facing; 9919* 20 71 9B
        jsr place_creature_sprites; 991C* 20 37 9B
        lda $D015             ; 991F* AD 15 D0
        ora #$0C              ; 9922* 09 0C
        sta $D015             ; 9924* 8D 15 D0
        lda #$00              ; 9927* A9 00
        sta npc_step_phase    ; 9929* 8D 8B 0A
        sta npc_frame_ofs     ; 992C* 8D 8C 0A
        sta npc_turned        ; 992F* 8D 8D 0A
        sta npc_frame_ctr     ; 9932* 8D 86 0A
        lda #$04              ; 9935* A9 04
        sta npc_frame_period  ; 9937* 8D 87 0A
        lda blk_npc_gate      ; 993A* AD E1 09
        pha                   ; 993D* 48
        and #$0F              ; 993E* 29 0F
; $09E1 low nibble picks $0A68 (Kindar) or $0A69 (Erdling), high nibble is the level
        sta npc_req_stat      ; 9940* 8D 8F 0A
        pla                   ; 9943* 68
        lsr a                 ; 9944* 4A
        lsr a                 ; 9945* 4A
        lsr a                 ; 9946* 4A
        lsr a                 ; 9947* 4A
        sta npc_req_level     ; 9948* 8D 8E 0A
        inc npc_active        ; 994B* EE 82 0A
        rts                   ; 994E* 60
species_sprite_lo:    ; <- 986C
        .byte $80,$00,$80,$00,$80,$00,$80,$00,$80,$00,$80; 994F  ...........
species_sprite_hi:    ; <- 9871
        .byte $E0,$E2,$E3,$E5,$E6,$E8,$E9,$EB,$EC,$EE,$EF; 995A  ...........
sprite_dst_lo:    ; <- 9889
        .byte $00,$80,$00                             ; 9965  ...
sprite_dst_hi:    ; <- 988E
        .byte $FE,$FD,$FD                             ; 9968  ...
sprite_mirror_lo:    ; <- 9893
        .byte $80,$00,$80                             ; 996B  ...
sprite_mirror_hi:    ; <- 9898
        .byte $FF,$FF,$FE                             ; 996E  ...
; creature AI, once per frame from irq_tick -- not per state step
creature_step:    ; <- 9806
        lda npc_active        ; 9971* AD 82 0A
        bne L9977             ; 9974* D0 01
        rts                   ; 9976* 60
L9977:    ; <- 9974
        inc npc_frame_ctr     ; 9977* EE 86 0A
        lda npc_frame_ctr     ; 997A* AD 86 0A
        cmp npc_frame_period  ; 997D* CD 87 0A
        beq L9983             ; 9980* F0 01
        rts                   ; 9982* 60
L9983:    ; <- 9980
        lda #$00              ; 9983* A9 00
        sta npc_frame_ctr     ; 9985* 8D 86 0A
        lda npc_col           ; 9988* AD 80 0A
        clc                   ; 998B* 18
        adc npc_dir           ; 998C* 6D 85 0A
        tax                   ; 998F* AA
        ldy npc_row           ; 9990* AC 81 0A
        jsr jt_read_tile      ; 9993* 20 06 9C
        sta npc_tile_ahead    ; 9996* 8D 89 0A
        ldx npc_col           ; 9999* AE 80 0A
        ldy npc_row           ; 999C* AC 81 0A
        iny                   ; 999F* C8
        jsr jt_read_tile      ; 99A0* 20 06 9C
        sta npc_tile_below    ; 99A3* 8D 8A 0A
        lda npc_step_phase    ; 99A6* AD 8B 0A
        beq L99AE             ; 99A9* F0 03
        jmp creature_half_step; 99AB* 4C 94 9A
L99AE:    ; <- 99A9
        lda npc_tile_below    ; 99AE* AD 8A 0A
        jsr jt_tile_props     ; 99B1* 20 09 9C
        lda tp_support        ; 99B4* AD 2C 0A
        bne L99C4             ; 99B7* D0 0B
        inc npc_row           ; 99B9* EE 81 0A
        lda #$04              ; 99BC* A9 04
        sta npc_frame_period  ; 99BE* 8D 87 0A
        jmp place_creature_sprites; 99C1* 4C 37 9B
L99C4:    ; <- 99B7
        lda npc_species       ; 99C4* AD 84 0A
        cmp #$08              ; 99C7* C9 08
        beq creature_contact  ; 99C9* F0 3B
        cmp #$09              ; 99CB* C9 09
        beq creature_contact  ; 99CD* F0 37
        lda blk_npc_kind      ; 99CF* AD F1 09
        and #$F0              ; 99D2* 29 F0
        cmp #$E0              ; 99D4* C9 E0
        bne L99DB             ; 99D6* D0 03
        jmp creature_ambush   ; 99D8  4C FA 9A
L99DB:    ; <- 99D6
        lda npc_col           ; 99DB* AD 80 0A
        clc                   ; 99DE* 18
        adc npc_dir           ; 99DF* 6D 85 0A
        cmp player_col        ; 99E2* CD 10 0A
        beq L99F0             ; 99E5* F0 09
        clc                   ; 99E7* 18
        adc npc_dir           ; 99E8* 6D 85 0A
        cmp player_col        ; 99EB* CD 10 0A
        bne creature_turn_or_step; 99EE* D0 48
L99F0:    ; <- 99E5
        ldx npc_row           ; 99F0* AE 81 0A
        cpx player_row        ; 99F3* EC 18 0A
        beq L9A05             ; 99F6* F0 0D
        inx                   ; 99F8  E8
        cpx player_row        ; 99F9  EC 18 0A
        beq L9A05             ; 99FC  F0 07
        dex                   ; 99FE  CA
        dex                   ; 99FF  CA
        cpx player_row        ; 9A00  EC 18 0A
        bne creature_turn_or_step; 9A03  D0 33
L9A05:    ; <- 99F6 99FC
        rts                   ; 9A05* 60
; species 8/9 only: writes $0A into $0A09 to request the knock-down
creature_contact:    ; <- 99C9 99CD
        lda knockdown_ctr     ; 9A06  AD 34 0A
        bne creature_turn_or_step; 9A09  D0 2D
        ldx npc_row           ; 9A0B  AE 81 0A
        cpx player_row        ; 9A0E  EC 18 0A
        beq L9A19             ; 9A11  F0 06
        dex                   ; 9A13  CA
        cpx player_row        ; 9A14  EC 18 0A
        bne creature_turn_or_step; 9A17  D0 1F
L9A19:    ; <- 9A11
        lda npc_col           ; 9A19  AD 80 0A
        cmp player_col        ; 9A1C  CD 10 0A
        beq L9A33             ; 9A1F  F0 12
        clc                   ; 9A21  18
        adc npc_dir           ; 9A22  6D 85 0A
        cmp player_col        ; 9A25  CD 10 0A
        beq L9A33             ; 9A28  F0 09
        clc                   ; 9A2A  18
        adc npc_dir           ; 9A2B  6D 85 0A
        cmp player_col        ; 9A2E  CD 10 0A
        bne creature_turn_or_step; 9A31  D0 05
L9A33:    ; <- 9A1F 9A28
        lda #$0A              ; 9A33  A9 0A
        sta fall_rows         ; 9A35  8D 09 0A
creature_turn_or_step:    ; <- 99EE 9A03 9A09 9A17 9A31 9B34
        lda npc_turned        ; 9A38* AD 8D 0A
        bne L9A6A             ; 9A3B* D0 2D
        lda npc_col           ; 9A3D* AD 80 0A
        cmp blk_npc_turn_a    ; 9A40* CD E5 09
        beq L9A4A             ; 9A43* F0 05
        cmp blk_npc_turn_b    ; 9A45* CD E6 09
        bne L9A6A             ; 9A48* D0 20
L9A4A:    ; <- 9A43 9A91
        lda #$00              ; 9A4A* A9 00
        sec                   ; 9A4C* 38
        sbc npc_dir           ; 9A4D* ED 85 0A
        sta npc_dir           ; 9A50* 8D 85 0A
        jsr set_creature_facing; 9A53* 20 71 9B
        jsr place_creature_sprites; 9A56* 20 37 9B
        ldx npc_gait          ; 9A59* AE 83 0A
        lda turn_pause,x      ; 9A5C* BD 68 9A
        sta npc_frame_period  ; 9A5F* 8D 87 0A
        lda #$01              ; 9A62* A9 01
        sta npc_turned        ; 9A64* 8D 8D 0A
        rts                   ; 9A67* 60
; frames to wait after turning, indexed by gait $0A83
turn_pause:    ; <- 9A5C
        .byte $0C,$08                                 ; 9A68  ..
L9A6A:    ; <- 9A3B 9A48
        jsr rnd               ; 9A6A* 20 39 80
        and #$07              ; 9A6D* 29 07
        bne L9A85             ; 9A6F* D0 14
        ldx npc_species       ; 9A71* AE 84 0A
        cpx #$08              ; 9A74* E0 08
        beq L9A84             ; 9A76* F0 0C
        cpx #$09              ; 9A78* E0 09
        beq L9A84             ; 9A7A* F0 08
        jsr rnd               ; 9A7C* 20 39 80
        and #$7F              ; 9A7F* 29 7F
        sta npc_frame_period  ; 9A81* 8D 87 0A
L9A84:    ; <- 9A76 9A7A
        rts                   ; 9A84* 60
L9A85:    ; <- 9A6F
        lda npc_turned        ; 9A85* AD 8D 0A
        bne creature_half_step; 9A88* D0 0A
        jsr rnd               ; 9A8A* 20 39 80
        and #$0F              ; 9A8D* 29 0F
        bne creature_half_step; 9A8F* D0 03
        jmp L9A4A             ; 9A91* 4C 4A 9A
creature_half_step:    ; <- 99AB 9A88 9A8F
        lda #$00              ; 9A94* A9 00
        sta npc_turned        ; 9A96* 8D 8D 0A
        lda npc_step_phase    ; 9A99* AD 8B 0A
        eor #$01              ; 9A9C* 49 01
        sta npc_step_phase    ; 9A9E* 8D 8B 0A
        tay                   ; 9AA1* A8
        lda step_period_slow,y; 9AA2* B9 F4 9A
        ldx npc_gait          ; 9AA5* AE 83 0A
        beq L9AAD             ; 9AA8* F0 03
        lda step_period_fast,y; 9AAA  B9 F6 9A
L9AAD:    ; <- 9AA8
        sta npc_frame_period  ; 9AAD* 8D 87 0A
        lda walk_frame,y      ; 9AB0* B9 F8 9A
        ldx npc_dir           ; 9AB3* AE 85 0A
        bmi L9ABB             ; 9AB6* 30 03
        clc                   ; 9AB8* 18
        adc #$06              ; 9AB9* 69 06
L9ABB:    ; <- 9AB6
        ldx npc_step_phase    ; 9ABB* AE 8B 0A
        beq L9ACF             ; 9ABE* F0 0F
        clc                   ; 9AC0* 18
        adc npc_frame_ofs     ; 9AC1* 6D 8C 0A
        pha                   ; 9AC4* 48
        lda #$02              ; 9AC5* A9 02
        sec                   ; 9AC7* 38
        sbc npc_frame_ofs     ; 9AC8* ED 8C 0A
        sta npc_frame_ofs     ; 9ACB* 8D 8C 0A
        pla                   ; 9ACE* 68
L9ACF:    ; <- 9ABE
        tax                   ; 9ACF* AA
        jsr set_creature_frame; 9AD0* 20 69 9B
        lda npc_step_phase    ; 9AD3* AD 8B 0A
        bne L9AF0             ; 9AD6* D0 18
        clc                   ; 9AD8* 18
        lda npc_col           ; 9AD9* AD 80 0A
        adc npc_dir           ; 9ADC* 6D 85 0A
        sta npc_col           ; 9ADF* 8D 80 0A
        lda npc_tile_ahead    ; 9AE2* AD 89 0A
        jsr jt_tile_props     ; 9AE5* 20 09 9C
        lda tp_solid          ; 9AE8* AD 2D 0A
        beq L9AF0             ; 9AEB* F0 03
        dec npc_row           ; 9AED* CE 81 0A
L9AF0:    ; <- 9AD6 9AEB
        jsr place_creature_sprites; 9AF0* 20 37 9B
        rts                   ; 9AF3* 60
step_period_slow:    ; <- 9AA2
        .byte $08,$0C                                 ; 9AF4  ..
step_period_fast:    ; <- 9AAA
        .byte $06,$0A                                 ; 9AF6  ..
; walk frame base $F4/$F6; +6 faces right, +$0A8C alternates
walk_frame:    ; <- 9AB0
        .byte $F4,$F6                                 ; 9AF8  ..
; $09F1 high nibble $E0: copies it to $D1 and drops out of the loop
creature_ambush:    ; <- 99D8
        ldx npc_col           ; 9AFA  AE 80 0A
        cpx player_col        ; 9AFD  EC 10 0A
        beq L9B15             ; 9B00  F0 13
        inx                   ; 9B02  E8
        cpx player_col        ; 9B03  EC 10 0A
        beq L9B15             ; 9B06  F0 0D
        dex                   ; 9B08  CA
        dex                   ; 9B09  CA
        cpx player_col        ; 9B0A  EC 10 0A
        beq L9B15             ; 9B0D  F0 06
        dex                   ; 9B0F  CA
        cpx player_col        ; 9B10  EC 10 0A
        bne L9B34             ; 9B13  D0 1F
L9B15:    ; <- 9B00 9B06 9B0D
        ldx npc_row           ; 9B15  AE 81 0A
        cpx player_row        ; 9B18  EC 18 0A
        beq L9B2A             ; 9B1B  F0 0D
        inx                   ; 9B1D  E8
        cpx player_row        ; 9B1E  EC 18 0A
        beq L9B2A             ; 9B21  F0 07
        dex                   ; 9B23  CA
        dex                   ; 9B24  CA
        cpx player_row        ; 9B25  EC 18 0A
        bne L9B34             ; 9B28  D0 0A
L9B2A:    ; <- 9B1B 9B21
        lda blk_npc_kind      ; 9B2A  AD F1 09
        sta creature_hit      ; 9B2D  85 D1
        lda #$00              ; 9B2F  A9 00
        sta game_active       ; 9B31  8D 04 0A
L9B34:    ; <- 9B13 9B28
        jmp creature_turn_or_step; 9B34  4C 38 9A
place_creature_sprites:    ; <- 991C 99C1 9A56 9AF0
        ldx npc_row           ; 9B37* AE 81 0A
        lda row_to_y,x        ; 9B3A* BD 70 0B
        sec                   ; 9B3D* 38
        sbc #$0A              ; 9B3E* E9 0A
        sta $D007             ; 9B40* 8D 07 D0
        sbc #$15              ; 9B43* E9 15
        sta $D005             ; 9B45* 8D 05 D0
        ldx npc_col           ; 9B48* AE 80 0A
        cpx #$1E              ; 9B4B* E0 1E
        bcs L9B57             ; 9B4D* B0 08
        lda $D010             ; 9B4F* AD 10 D0
        and #$F3              ; 9B52* 29 F3
        jmp L9B5C             ; 9B54* 4C 5C 9B
L9B57:    ; <- 9B4D
        lda $D010             ; 9B57* AD 10 D0
        ora #$0C              ; 9B5A* 09 0C
L9B5C:    ; <- 9B54
        sta $D010             ; 9B5C* 8D 10 D0
        lda col_to_x,x        ; 9B5F* BD 40 0B
        sta $D004             ; 9B62* 8D 04 D0
        sta $D006             ; 9B65* 8D 06 D0
        rts                   ; 9B68* 60
set_creature_frame:    ; <- 9AD0 9B7A
        stx DC3FA             ; 9B69* 8E FA C3
        inx                   ; 9B6C* E8
        stx DC3FB             ; 9B6D* 8E FB C3
        rts                   ; 9B70* 60
set_creature_facing:    ; <- 9919 9A53
        ldx #$F4              ; 9B71* A2 F4
        lda npc_dir           ; 9B73* AD 85 0A
        bmi L9B7A             ; 9B76* 30 02
        ldx #$FA              ; 9B78* A2 FA
L9B7A:    ; <- 9B76
        jmp set_creature_frame; 9B7A* 4C 69 9B
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9B7D  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9B8D  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9B9D  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9BAD  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9BBD  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9BCD  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9BDD  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9BED  ................
        .byte $00,$00,$00                             ; 9BFD  ...
jt_sample_neighbors:    ; <- 8554 A032 A511 AC77
        jmp sample_neighbors  ; 9C00* 4C FD 9C
jt_move_sprite:    ; <- 8691 9637 972F 9780 A20C A722 AB3C AC90
        jmp move_player_sprite; 9C03* 4C 36 9D
jt_read_tile:    ; <- 8578 8666 8677 86A9 8716 8725 8734 9241 9324 9993 99A0
        jmp read_tile         ; 9C06* 4C 68 9D
jt_tile_props:    ; <- 8669 8737 99B1 9AE5 A038 A0C6 A147 A183 A237 A296 A39D A3BD A47F A4C5 A4DD AE9E AEDF
        jmp tile_props        ; 9C09* 4C 90 9D
jt_swap_charset_banks:    ; <- 89B7 9459
        jmp swap_charset_banks; 9C0C* 4C 1C 9C
jt_draw_player:    ; <- 3725 972C 9771 A0B4 A12B A244 A282 A323 A3AD A419 A567 A63E A679 AB39 AD2E
        jmp draw_player       ; 9C0F* 4C F6 9D
jt_anim_water_char:    ; <- A000
        jmp anim_water_char   ; 9C12* 4C 43 9C
jt_init_character:    ; <- 36D0 975E
        jmp init_character    ; 9C15* 4C 6E 9C
jt_quest_complete:    ; <- 44A4
        jmp quest_complete    ; 9C18  4C 17 9E
D9C1B:    ; <- 3B5D
        .byte $43                                     ; 9C1B  C
swap_charset_banks:    ; <- 9C0C
        lda #$C7              ; 9C1C* A9 C7
        sta $81               ; 9C1E* 85 81
        lda #$B7              ; 9C20* A9 B7
        sta $83               ; 9C22* 85 83
        lda #$00              ; 9C24* A9 00
        sta $80               ; 9C26* 85 80
        sta $82               ; 9C28* 85 82
        ldx #$09              ; 9C2A* A2 09
        ldy #$00              ; 9C2C* A0 00
L9C2E:    ; <- 9C39 9C40
        lda ($80),y           ; 9C2E* B1 80
        pha                   ; 9C30* 48
        lda ($82),y           ; 9C31* B1 82
        sta ($80),y           ; 9C33* 91 80
        pla                   ; 9C35* 68
        sta ($82),y           ; 9C36* 91 82
        dey                   ; 9C38* 88
        bne L9C2E             ; 9C39* D0 F3
        inc $81               ; 9C3B* E6 81
        inc $83               ; 9C3D* E6 83
        dex                   ; 9C3F* CA
        bne L9C2E             ; 9C40* D0 EC
        rts                   ; 9C42* 60
anim_water_char:    ; <- 9C12
        dec water_anim_ctr    ; 9C43* CE 49 0A
        bmi L9C49             ; 9C46* 30 01
        rts                   ; 9C48* 60
L9C49:    ; <- 9C46
        lda #$07              ; 9C49* A9 07
        sta water_anim_ctr    ; 9C4B* 8D 49 0A
        dec water_anim_frame  ; 9C4E* CE 3F 0A
        bpl L9C58             ; 9C51* 10 05
        lda #$02              ; 9C53* A9 02
        sta water_anim_frame  ; 9C55* 8D 3F 0A
L9C58:    ; <- 9C51
        ldx water_anim_frame  ; 9C58* AE 3F 0A
        ldy D9C6B,x           ; 9C5B* BC 6B 9C
        ldx #$07              ; 9C5E* A2 07
L9C60:    ; <- 9C68
        lda DCDE8,y           ; 9C60* B9 E8 CD
        sta DC900,x           ; 9C63* 9D 00 C9
        dey                   ; 9C66* 88
        dex                   ; 9C67* CA
        bpl L9C60             ; 9C68* 10 F6
        rts                   ; 9C6A* 60
D9C6B:    ; <- 9C5B
        .byte $07,$0F,$17                             ; 9C6B  ...
init_character:    ; <- 9C15
        ldx loaded_player     ; 9C6E* AE 60 0A
        lda demo_flag         ; 9C71* AD 92 0A
        beq L9C7D             ; 9C74* F0 07
        ldx #$05              ; 9C76* A2 05
        lda #$60              ; 9C78* A9 60
        sta obj_class_shuba   ; 9C7A* 8D 58 0F
L9C7D:    ; <- 9C74
        ldy char_record_ends,x; 9C7D* BC A3 9C
        ldx #$0D              ; 9C80* A2 0D
; 14 bytes per character -> $0A63-$0A70
L9C82:    ; <- 9C8A
        lda char_records,y    ; 9C82* B9 A9 9C
        sta spirit_energy,x   ; 9C85* 9D 63 0A
        dey                   ; 9C88* 88
        dex                   ; 9C89* CA
        bpl L9C82             ; 9C8A* 10 F6
        lda #$00              ; 9C8C* A9 00
        sta time_of_day       ; 9C8E* 8D 61 0A
        sta carried_weight    ; 9C91* 8D 7A 0A
        sta vision_count      ; 9C94* 85 DC
        sta pense_msg_count   ; 9C96* 85 DD
        lda #$01              ; 9C98* A9 01
        sta day               ; 9C9A* 8D 62 0A
        lda #$23              ; 9C9D* A9 23
        sta clock_period      ; 9C9F* 8D 79 0A
        rts                   ; 9CA2* 60
char_record_ends:    ; <- 9C7D
        .byte $0D,$1B,$29,$37,$45,$53                 ; 9CA3  ..)7ES
char_records:    ; <- 9C82
        .byte $05,$0A,$0A,$14,$05,$03,$00,$0B,$0B,$2E,$3D,$00,$16,$09,$00,$0A; 9CA9  ..........=.....
        .byte $0A,$14,$00,$04,$02,$0B,$0B,$2E,$2C,$00,$1D,$09,$05,$0A,$0A,$14; 9CB9  ........,.......
        .byte $05,$00,$03,$0B,$0B,$2E,$1F,$00,$1B,$09,$0A,$05,$05,$0A,$0A,$05; 9CC9  ................
        .byte $03,$06,$06,$24,$05,$00,$16,$09,$05,$07,$07,$0F,$05,$02,$05,$08; 9CD9  ...$............
        .byte $08,$29,$35,$00,$1D,$09,$0A,$0A,$0A,$14,$0A,$00,$03,$0B,$0B,$2E; 9CE9  .)5.............
        .byte $1F,$00,$1B,$09                         ; 9CF9  ....
; fills $0A20-$0A2A with the 11 cells around the player
sample_neighbors:    ; <- 9C00
        lda #$0A              ; 9CFD* A9 0A
        sta $8E               ; 9CFF* 85 8E
L9D01:    ; <- 9D1D
        ldx $8E               ; 9D01* A6 8E
        lda player_row        ; 9D03* AD 18 0A
        clc                   ; 9D06* 18
        adc neighbor_dy,x     ; 9D07* 7D 2B 9D
        tay                   ; 9D0A* A8
        lda player_col        ; 9D0B* AD 10 0A
        clc                   ; 9D0E* 18
        adc neighbor_dx,x     ; 9D0F* 7D 20 9D
        tax                   ; 9D12* AA
        jsr read_tile         ; 9D13* 20 68 9D
        ldx $8E               ; 9D16* A6 8E
        sta tile_at,x         ; 9D18* 9D 20 0A
        dec $8E               ; 9D1B* C6 8E
        bpl L9D01             ; 9D1D* 10 E2
        rts                   ; 9D1F* 60
neighbor_dx:    ; <- 9D0F
        .byte $00,$FF,$01,$00,$FF,$01,$00,$00,$00,$FF,$01; 9D20  ...........
neighbor_dy:    ; <- 9D07
        .byte $00,$00,$00,$01,$01,$01,$FF,$FE,$FD,$FE,$FE; 9D2B  ...........
move_player_sprite:    ; <- 9C03
        ldx player_row        ; 9D36* AE 18 0A
        lda row_to_y,x        ; 9D39* BD 70 0B
        sec                   ; 9D3C* 38
        sbc #$0A              ; 9D3D* E9 0A
        sta $D003             ; 9D3F* 8D 03 D0
        sbc #$15              ; 9D42* E9 15
        sta $D001             ; 9D44* 8D 01 D0
        ldx player_col        ; 9D47* AE 10 0A
        cpx #$1E              ; 9D4A* E0 1E
        bcs L9D56             ; 9D4C* B0 08
        lda $D010             ; 9D4E* AD 10 D0
        and #$FC              ; 9D51* 29 FC
        jmp L9D5B             ; 9D53* 4C 5B 9D
L9D56:    ; <- 9D4C
        lda $D010             ; 9D56* AD 10 D0
        ora #$03              ; 9D59* 09 03
L9D5B:    ; <- 9D53
        sta $D010             ; 9D5B* 8D 10 D0
        lda col_to_x,x        ; 9D5E* BD 40 0B
        sta $D000             ; 9D61* 8D 00 D0
        sta $D002             ; 9D64* 8D 02 D0
        rts                   ; 9D67* 60
read_tile:    ; <- 9C06 9D13
        cpx #$FF              ; 9D68* E0 FF
        beq L9D8D             ; 9D6A* F0 21
        cpx #$28              ; 9D6C* E0 28
        beq L9D8D             ; 9D6E* F0 1D
        cpy #$00              ; 9D70* C0 00
        bmi L9D8D             ; 9D72* 30 19
        lda row_addr_lo,y     ; 9D74* B9 00 0B
        sta $8C               ; 9D77* 85 8C
        lda row_addr_hi,y     ; 9D79* B9 20 0B
        sta $8D               ; 9D7C* 85 8D
        clc                   ; 9D7E* 18
        txa                   ; 9D7F* 8A
        adc $8C               ; 9D80* 65 8C
        sta $8C               ; 9D82* 85 8C
        bcc L9D88             ; 9D84* 90 02
        inc $8D               ; 9D86* E6 8D
L9D88:    ; <- 9D84
        ldy #$00              ; 9D88* A0 00
        lda ($8C),y           ; 9D8A* B1 8C
        rts                   ; 9D8C* 60
L9D8D:    ; <- 9D6A 9D6E 9D72
        lda #$00              ; 9D8D* A9 00
        rts                   ; 9D8F* 60
; tile code in A -> $0A2C support / $0A2D solid / $0A2E climbable
tile_props:    ; <- 9C09
        pha                   ; 9D90* 48
        ldx #$02              ; 9D91* A2 02
        lda #$00              ; 9D93* A9 00
L9D95:    ; <- 9D99
        sta tp_support,x      ; 9D95* 9D 2C 0A
        dex                   ; 9D98* CA
        bpl L9D95             ; 9D99* 10 FA
        pla                   ; 9D9B* 68
        cmp #$00              ; 9D9C* C9 00
        beq L9DF5             ; 9D9E* F0 55
        cmp #$07              ; 9DA0* C9 07
        bcs L9DAC             ; 9DA2* B0 08
        inc tp_support        ; 9DA4* EE 2C 0A
        inc tp_solid          ; 9DA7* EE 2D 0A
        bne L9DF5             ; 9DAA* D0 49
L9DAC:    ; <- 9DA2
        cmp #$19              ; 9DAC* C9 19
        bcc L9DF5             ; 9DAE* 90 45
        cmp #$1C              ; 9DB0* C9 1C
        bcs L9DBC             ; 9DB2* B0 08
        inc tp_support        ; 9DB4* EE 2C 0A
        inc tp_solid          ; 9DB7* EE 2D 0A
        bne L9DF5             ; 9DBA* D0 39
L9DBC:    ; <- 9DB2
        cmp #$75              ; 9DBC* C9 75
        bne L9DC8             ; 9DBE* D0 08
        inc tp_support        ; 9DC0  EE 2C 0A
        inc tp_solid          ; 9DC3  EE 2D 0A
        bne L9DF5             ; 9DC6  D0 2D
L9DC8:    ; <- 9DBE
        cmp #$B4              ; 9DC8* C9 B4
        bcc L9DF5             ; 9DCA* 90 29
        cmp #$BA              ; 9DCC* C9 BA
        bcs L9DD8             ; 9DCE* B0 08
        inc tp_support        ; 9DD0* EE 2C 0A
        inc tp_climb          ; 9DD3* EE 2E 0A
        bne L9DF5             ; 9DD6* D0 1D
L9DD8:    ; <- 9DCE
        cmp #$E0              ; 9DD8  C9 E0
        bne L9DE9             ; 9DDA  D0 0D
        lda crawling          ; 9DDC  AD 3D 0A
        beq L9DF5             ; 9DDF  F0 14
        inc tp_support        ; 9DE1  EE 2C 0A
        inc tp_solid          ; 9DE4  EE 2D 0A
        bne L9DF5             ; 9DE7  D0 0C
L9DE9:    ; <- 9DDA
        cmp #$DF              ; 9DE9  C9 DF
        bne L9DF5             ; 9DEB  D0 08
        inc tp_support        ; 9DED  EE 2C 0A
        inc tp_solid          ; 9DF0  EE 2D 0A
        bne L9DF5             ; 9DF3  D0 00
L9DF5:    ; <- 9D9E 9DAA 9DAE 9DBA 9DC6 9DCA 9DD6 9DDF 9DE7 9DEB 9DF3
        rts                   ; 9DF5* 60
; resting pose only; the moving states set $C3F8 themselves
draw_player:    ; <- 9C0F
        lda crawling          ; 9DF6* AD 3D 0A
        bne L9E06             ; 9DF9* D0 0B
        ldx #$C4              ; 9DFB* A2 C4
        lda facing            ; 9DFD* AD 37 0A
        bmi L9E0F             ; 9E00* 30 0D
        ldx #$CA              ; 9E02* A2 CA
        bne L9E0F             ; 9E04* D0 09
L9E06:    ; <- 9DF9
        ldx #$E6              ; 9E06* A2 E6
        lda facing            ; 9E08* AD 37 0A
        bmi L9E0F             ; 9E0B* 30 02
        ldx #$EC              ; 9E0D* A2 EC
L9E0F:    ; <- 9E00 9E04 9E0B
        stx DC3F8             ; 9E0F* 8E F8 C3
        inx                   ; 9E12* E8
        stx DC3F9             ; 9E13* 8E F9 C3
        rts                   ; 9E16* 60
; rank comes from $0A62 alone: <15 master, <30 highly gifted, else gifted
quest_complete:    ; <- 9C18
        jsr jt_clear_text_rows; 9E17  20 06 95
        jsr print_inline      ; 9E1A  20 09 80
        .byte $49,$C3,$49,$20,$41,$4D,$20,$52,$41,$41,$4D,$4F,$2C,$20,$54,$48; 9E1D  I.I AM RAAMO, TH
        .byte $45,$20,$53,$50,$49,$52,$49,$54,$20,$47,$49,$46,$54,$45,$44,$2E; 9E2D  E SPIRIT GIFTED.
        .byte $FF                                     ; 9E3D  .
        jsr print_inline      ; 9E3E  20 09 80
        .byte $71,$C3,$59,$4F,$55,$20,$48,$41,$56,$45,$20,$53,$41,$56,$45,$44; 9E41  q.YOU HAVE SAVED
        .byte $20,$4D,$59,$20,$4C,$49,$46,$45,$20,$41,$4E,$44,$20,$46,$55,$4C; 9E51   MY LIFE AND FUL
        .byte $46,$49,$4C,$4C,$45,$44,$20,$20,$20,$20,$54,$48,$45,$20,$50,$52; 9E61  FILLED    THE PR
        .byte $4F,$50,$48,$45,$53,$59,$2E,$20,$20,$54,$48,$45,$20,$51,$55,$45; 9E71  OPHESY.  THE QUE
        .byte $53,$54,$20,$49,$53,$20,$43,$4F,$4D,$50,$4C,$45,$54,$45,$2E,$20; 9E81  ST IS COMPLETE. 
        .byte $20,$20,$47,$52,$45,$45,$4E,$2D,$53,$4B,$59,$20,$49,$53,$20,$53; 9E91    GREEN-SKY IS S
        .byte $41,$56,$45,$44,$2E,$FF                 ; 9EA1  AVED..
        lda #$00              ; 9EA7  A9 00
        jsr jt_music_play     ; 9EA9  20 00 28
L9EAC:    ; <- 9EAF
        lda music_on          ; 9EAC  AD 95 0A
        bne L9EAC             ; 9EAF  D0 FB
        ldx #$FF              ; 9EB1  A2 FF
        jsr jt_delay          ; 9EB3  20 12 80
        jsr jt_clear_text_rows; 9EB6  20 06 95
        jsr print_inline      ; 9EB9  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$48,$41,$56,$45,$20,$46,$49,$4E,$49,$53; 9EBC  I.YOU HAVE FINIS
        .byte $48,$45,$44,$20,$54,$48,$45,$20,$51,$55,$45,$53,$54,$20,$49,$4E; 9ECC  HED THE QUEST IN
        .byte $20,$20,$20,$20,$44,$41,$59,$53,$2E,$20,$59,$4F,$55,$20,$41,$52; 9EDC      DAYS. YOU AR
        .byte $45,$20,$41,$FF                         ; 9EEC  E A.
        ldx day               ; 9EF0  AE 62 0A
        ldy #$00              ; 9EF3  A0 00
        jsr jt_to_decimal     ; 9EF5  20 0C 80
        lda $95               ; 9EF8  A5 95
        sta DC368             ; 9EFA  8D 68 C3
        lda $96               ; 9EFD  A5 96
        sta DC369             ; 9EFF  8D 69 C3
        lda day               ; 9F02  AD 62 0A
; quest rating: >= 30 days gifted, 15-29 highly gifted, under 15 master
        cmp #$1E              ; 9F05  C9 1E
        bcc L9F21             ; 9F07  90 18
        jsr print_inline      ; 9F09  20 09 80
        .byte $7B,$C3,$47,$49,$46,$54,$45,$44,$20,$51,$55,$45,$53,$54,$45,$52; 9F0C  {.GIFTED QUESTER
        .byte $2E,$FF                                 ; 9F1C  ..
        jmp L9F59             ; 9F1E  4C 59 9F
L9F21:    ; <- 9F07
        cmp #$0F              ; 9F21  C9 0F
        bcc L9F44             ; 9F23  90 1F
        jsr print_inline      ; 9F25  20 09 80
        .byte $7B,$C3,$48,$49,$47,$48,$4C,$59,$20,$47,$49,$46,$54,$45,$44,$20; 9F28  {.HIGHLY GIFTED 
        .byte $51,$55,$45,$53,$54,$45,$52,$2E,$FF     ; 9F38  QUESTER..
        jmp L9F59             ; 9F41  4C 59 9F
L9F44:    ; <- 9F23
        jsr print_inline      ; 9F44  20 09 80
        .byte $7B,$C3,$4D,$41,$53,$54,$45,$52,$20,$51,$55,$45,$53,$54,$45,$52; 9F47  {.MASTER QUESTER
        .byte $2E,$FF                                 ; 9F57  ..
L9F59:    ; <- 9F1E 9F41
        lda #$02              ; 9F59  A9 02
        jsr jt_music_play     ; 9F5B  20 00 28
L9F5E:    ; <- 9F61
        lda music_on          ; 9F5E  AD 95 0A
        bne L9F5E             ; 9F61  D0 FB
L9F63:    ; <- 9F66
        jsr jt_get_input      ; 9F63  20 0F 80
        beq L9F63             ; 9F66  F0 FB
        lda #$00              ; 9F68  A9 00
        sta quest_active      ; 9F6A  85 D7
        jmp jt_wait_input     ; 9F6C  4C 27 80
        .byte $80,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9F6F  ................
        .byte $00                                     ; 9F7F  .
; X = fatigue; every 256 points costs one food and one rest
spend_fatigue:    ; <- A2E4 A35A A509
        lda dream_state       ; 9F80* A5 C8
        bne L9FB2             ; 9F82* D0 2E
        stx $C7               ; 9F84* 86 C7
        lda fatigue           ; 9F86* A5 C5
        sec                   ; 9F88* 38
        sbc $C7               ; 9F89* E5 C7
        sta fatigue           ; 9F8B* 85 C5
        bcc L9F90             ; 9F8D* 90 01
        rts                   ; 9F8F* 60
L9F90:    ; <- 9F8D
        dec food              ; 9F90* CE 64 0A
        bpl L9FA1             ; 9F93* 10 0C
        inc food              ; 9F95  EE 64 0A
        lda #$01              ; 9F98  A9 01
        sta fatigue_cause     ; 9F9A  85 C4
        lda #$00              ; 9F9C  A9 00
        sta game_active       ; 9F9E  8D 04 0A
L9FA1:    ; <- 9F93
        dec rest              ; 9FA1* CE 65 0A
        bpl L9FB2             ; 9FA4* 10 0C
        inc rest              ; 9FA6  EE 65 0A
        lda #$02              ; 9FA9  A9 02
        sta fatigue_cause     ; 9FAB  85 C4
        lda #$00              ; 9FAD  A9 00
        sta game_active       ; 9FAF  8D 04 0A
L9FB2:    ; <- 9F82 9FA4
        rts                   ; 9FB2* 60
; $0F00 index 0 is literal: class 0 has exactly one slot, the bell
check_spirit_bell:    ; <- A496
        lda tile_at           ; 9FB3* AD 20 0A
        cmp #$BB              ; 9FB6* C9 BB
        bne L9FDA             ; 9FB8* D0 20
        lda room_hi           ; 9FBA  A5 87
        beq L9FDA             ; 9FBC  F0 1C
        lda room_lo           ; 9FBE  A5 86
        cmp #$80              ; 9FC0  C9 80
        bcc L9FDA             ; 9FC2  90 16
        lda obj_flags         ; 9FC4  AD 00 0F
        bit obj_bit_carried   ; 9FC7  2C A5 0A
        beq L9FDA             ; 9FCA  F0 0E
        ldx #$0C              ; 9FCC  A2 0C
        jsr jt_sfx            ; 9FCE  20 06 A8
        lda #$00              ; 9FD1  A9 00
        sta game_active       ; 9FD3  8D 04 0A
        lda #$01              ; 9FD6  A9 01
        sta spirit_bell_rang  ; 9FD8  85 DF
L9FDA:    ; <- 9FB8 9FBC 9FC2 9FCA
        rts                   ; 9FDA* 60
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9FDB  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; 9FEB  ................
        .byte $00,$00,$00,$00,$00                     ; 9FFB  .....
; runs once per frame from the raster IRQ at line $DE
irq_tick:    ; <- 8AE4
        jsr jt_anim_water_char; A000* 20 12 9C
LA003:    ; <- A008
        jsr rnd               ; A003* 20 39 80
        and #$0F              ; A006* 29 0F
        beq LA003             ; A008* F0 F9
        sta $D01E             ; A00A* 8D 1E D0
        lda music_on          ; A00D* AD 95 0A
        beq LA015             ; A010* F0 03
        jsr jt_music_tick     ; A012* 20 03 28
LA015:    ; <- A010
        lda game_active       ; A015* AD 04 0A
        bne LA01B             ; A018* D0 01
        rts                   ; A01A* 60
LA01B:    ; <- A018
        jsr jt_clock_tick     ; A01B* 20 06 B1
        jsr jt_creature_step  ; A01E* 20 06 98
        inc step_counter      ; A021* EE 08 0A
        lda step_counter      ; A024* AD 08 0A
        cmp step_period       ; A027* CD 06 0A
        beq state_step        ; A02A* F0 01
        rts                   ; A02C* 60
; one state step, every $0A06 frames
state_step:    ; <- A02A A24C
        lda #$00              ; A02D* A9 00
        sta step_counter      ; A02F* 8D 08 0A
        jsr jt_sample_neighbors; A032* 20 00 9C
        lda tile_below        ; A035* AD 23 0A
        jsr jt_tile_props     ; A038* 20 09 9C
        lda stooping          ; A03B* AD 3E 0A
        beq LA043             ; A03E* F0 03
        jmp end_stoop_pose    ; A040* 4C 14 A4
LA043:    ; <- A03E
        lda tp_support        ; A043* AD 2C 0A
        beq LA05E             ; A046* F0 16
        lda fall_rows         ; A048* AD 09 0A
        beq LA05E             ; A04B* F0 11
        cmp #$06              ; A04D* C9 06
        bcc LA054             ; A04F* 90 03
        jmp knockdown_start   ; A051* 4C 39 A3
LA054:    ; <- A04F
        ldx #$02              ; A054* A2 02
        jsr jt_sfx            ; A056* 20 06 A8
        lda #$00              ; A059* A9 00
        sta fall_rows         ; A05B* 8D 09 0A
LA05E:    ; <- A046 A04B
        lda walk_phase        ; A05E* AD 38 0A
        beq LA066             ; A061* F0 03
        jmp walk_step         ; A063* 4C 1D A4
LA066:    ; <- A061
        lda knockdown_ctr     ; A066* AD 34 0A
        beq LA06E             ; A069* F0 03
        jmp knockdown_anim    ; A06B* 4C FB A2
LA06E:    ; <- A069
        lda leaping           ; A06E* AD 30 0A
        beq LA076             ; A071* F0 03
        jmp leap_step         ; A073* 4C 1C A2
LA076:    ; <- A071
        lda gliding           ; A076* AD 35 0A
        beq input_fire        ; A079* F0 03
        jmp glide_step        ; A07B* 4C 9A A3
input_fire:    ; <- A079
        lda in_dx             ; A07E* A5 98
        sta D0A33             ; A080* 8D 33 0A
        jsr jt_get_input      ; A083* 20 0F 80
        beq input_nofire      ; A086* F0 5F
        lda fall_rows         ; A088* AD 09 0A
        cmp #$02              ; A08B* C9 02
        bcc LA09C             ; A08D* 90 0D
        lda tp_support        ; A08F* AD 2C 0A
        bne LA09C             ; A092* D0 08
        lda no_glide          ; A094* AD 4C 0A
        bne LA09C             ; A097* D0 03
        jmp try_glide         ; A099* 4C 70 A3
LA09C:    ; <- A08D A092 A097
        lda in_dx             ; A09C* A5 98
        beq LA0BD             ; A09E* F0 1D
        lda tp_support        ; A0A0* AD 2C 0A
        beq input_nofire      ; A0A3* F0 42
        lda in_dx             ; A0A5* A5 98
        cmp facing            ; A0A7* CD 37 0A
        beq LA0BA             ; A0AA* F0 0E
        sta facing            ; A0AC* 8D 37 0A
        jsr showing_climb_frame; A0AF* 20 61 A3
        bcs LA0BA             ; A0B2* B0 06
        jsr jt_draw_player    ; A0B4  20 0F 9C
        jmp commit_step       ; A0B7  4C B1 A1
LA0BA:    ; <- A0AA A0B2
        jmp leap_start        ; A0BA* 4C A8 A2
LA0BD:    ; <- A09E
        lda in_dy             ; A0BD* A5 99
        beq LA0D9             ; A0BF* F0 18
        bmi input_nofire      ; A0C1* 30 24
        lda tile_below        ; A0C3* AD 23 0A
        jsr jt_tile_props     ; A0C6* 20 09 9C
        lda tp_support        ; A0C9* AD 2C 0A
        beq LA0D9             ; A0CC* F0 0B
        lda #$00              ; A0CE* A9 00
        sta game_active       ; A0D0* 8D 04 0A
        lda #$01              ; A0D3* A9 01
        sta menu_req          ; A0D5* 8D 4A 0A
        rts                   ; A0D8* 60
LA0D9:    ; <- A0BF A0CC
        lda tile_at           ; A0D9* AD 20 0A
        cmp #$BA              ; A0DC* C9 BA
        bcc input_nofire      ; A0DE* 90 07
        cmp #$BD              ; A0E0  C9 BD
        bcs input_nofire      ; A0E2  B0 03
        jmp request_door      ; A0E4  4C 94 A5
input_nofire:    ; <- A086 A0A3 A0C1 A0DE A0E2 A37D
        lda tp_support        ; A0E7* AD 2C 0A
        bne on_ground         ; A0EA* D0 1A
        inc player_row        ; A0EC* EE 18 0A
        lda #$04              ; A0EF* A9 04
        sta step_period       ; A0F1* 8D 06 0A
        inc fall_rows         ; A0F4* EE 09 0A
        lda fall_rows         ; A0F7* AD 09 0A
        cmp #$02              ; A0FA* C9 02
        bne LA103             ; A0FC* D0 05
        ldx #$09              ; A0FE* A2 09
        jsr jt_sfx            ; A100* 20 06 A8
LA103:    ; <- A0FC
        jmp commit_move       ; A103* 4C B6 A1
on_ground:    ; <- A0EA
        lda tile_at           ; A106* AD 20 0A
        cmp #$B5              ; A109* C9 B5
        beq LA111             ; A10B* F0 04
        cmp #$B8              ; A10D* C9 B8
        bne LA11F             ; A10F* D0 0E
LA111:    ; <- A10B
        lda tile_below        ; A111* AD 23 0A
        cmp #$B5              ; A114* C9 B5
        beq LA11C             ; A116* F0 04
        cmp #$B8              ; A118* C9 B8
        bne LA11F             ; A11A* D0 03
LA11C:    ; <- A116
        jmp vertical_input    ; A11C* 4C 3D A1
LA11F:    ; <- A10F A11A
        lda in_dx             ; A11F* A5 98
        beq vertical_input    ; A121* F0 1A
        cmp facing            ; A123* CD 37 0A
        beq LA131             ; A126* F0 09
        sta facing            ; A128* 8D 37 0A
        jsr jt_draw_player    ; A12B* 20 0F 9C
        jmp commit_step       ; A12E* 4C B1 A1
LA131:    ; <- A126
        sec                   ; A131* 38
        lda #$02              ; A132* A9 02
        sbc walk_frame        ; A134* ED 39 0A
        sta walk_frame        ; A137* 8D 39 0A
        jmp walk_step         ; A13A* 4C 1D A4
vertical_input:    ; <- A11C A121
        clc                   ; A13D* 18
        lda in_dy             ; A13E* A5 99
        beq LA1A6             ; A140* F0 64
        bpl LA180             ; A142* 10 3C
        lda tile_at           ; A144* AD 20 0A
        jsr jt_tile_props     ; A147* 20 09 9C
        lda tp_climb          ; A14A* AD 2E 0A
        bne LA15C             ; A14D* D0 0D
        lda crawling          ; A14F* AD 3D 0A
        beq LA1B0             ; A152* F0 5C
        lda #$00              ; A154* A9 00
        sta crawling          ; A156* 8D 3D 0A
        jmp stoop_pose        ; A159* 4C FD A3
LA15C:    ; <- A14D
        lda #$0A              ; A15C* A9 0A
        sta step_period       ; A15E* 8D 06 0A
        dec player_row        ; A161* CE 18 0A
        lda tile_at           ; A164* AD 20 0A
; ladder halves $B4/$B7 and $B6/$B9 pull the player to the centre column
ladder_column_snap:    ; <- A1A3
        cmp #$B4              ; A167* C9 B4
        beq LA16F             ; A169* F0 04
        cmp #$B7              ; A16B* C9 B7
        bne LA172             ; A16D* D0 03
LA16F:    ; <- A169
        inc player_col        ; A16F  EE 10 0A
LA172:    ; <- A16D
        cmp #$B6              ; A172* C9 B6
        beq LA17A             ; A174* F0 04
        cmp #$B9              ; A176* C9 B9
        bne LA17D             ; A178* D0 03
LA17A:    ; <- A174
        dec player_col        ; A17A  CE 10 0A
LA17D:    ; <- A178
        jmp climb_step        ; A17D* 4C A8 A4
LA180:    ; <- A142
        lda tile_below        ; A180* AD 23 0A
        jsr jt_tile_props     ; A183* 20 09 9C
        lda tp_climb          ; A186* AD 2E 0A
        bne LA198             ; A189* D0 0D
        lda crawling          ; A18B* AD 3D 0A
        bne LA1B0             ; A18E* D0 20
        lda #$01              ; A190* A9 01
        sta crawling          ; A192* 8D 3D 0A
        jmp stoop_pose        ; A195* 4C FD A3
LA198:    ; <- A189
        lda #$0A              ; A198  A9 0A
        sta step_period       ; A19A  8D 06 0A
        inc player_row        ; A19D  EE 18 0A
        lda tile_below        ; A1A0  AD 23 0A
        jmp ladder_column_snap; A1A3  4C 67 A1
LA1A6:    ; <- A140
        lda #$08              ; A1A6* A9 08
        sta step_period       ; A1A8* 8D 06 0A
        lda #$00              ; A1AB* A9 00
        sta running           ; A1AD* 8D 3C 0A
LA1B0:    ; <- A152 A18E
        rts                   ; A1B0* 60
commit_step:    ; <- A0B7 A12E A285 A2F8 A3B7 A3E9 A499 A4D0 A4EA A50C
        lda #$00              ; A1B1* A9 00
        sta fall_rows         ; A1B3* 8D 09 0A
commit_move:    ; <- A103
        jsr check_blocked_tile; A1B6* 20 11 A5
        jsr check_wall_hit    ; A1B9* 20 3D A5
        lda tile_at           ; A1BC* AD 20 0A
        cmp #$20              ; A1BF* C9 20
        bne check_room_edge   ; A1C1* D0 0A
        lda #$01              ; A1C3  A9 01
        sta drowned           ; A1C5  8D 4D 0A
        lda #$00              ; A1C8  A9 00
        sta game_active       ; A1CA  8D 04 0A
check_room_edge:    ; <- A1C1
        lda #$00              ; A1CD* A9 00
        sta D0A4E             ; A1CF* 8D 4E 0A
        lda player_col        ; A1D2* AD 10 0A
        bpl LA1E1             ; A1D5* 10 0A
        ldx #$04              ; A1D7* A2 04
        inc player_col        ; A1D9* EE 10 0A
        inc D0A4E             ; A1DC* EE 4E 0A
        bne LA1ED             ; A1DF* D0 0C
LA1E1:    ; <- A1D5
        cmp #$28              ; A1E1* C9 28
        bne LA1ED             ; A1E3* D0 08
        ldx #$02              ; A1E5* A2 02
        dec player_col        ; A1E7* CE 10 0A
        inc D0A4E             ; A1EA* EE 4E 0A
LA1ED:    ; <- A1DF A1E3
        lda player_row        ; A1ED* AD 18 0A
        bpl LA1F6             ; A1F0* 10 04
        ldx #$01              ; A1F2* A2 01
        bne LA203             ; A1F4* D0 0D
LA1F6:    ; <- A1F0
        cmp #$13              ; A1F6* C9 13
        bcc LA1FE             ; A1F8* 90 04
        ldx #$03              ; A1FA* A2 03
        bne LA203             ; A1FC* D0 05
LA1FE:    ; <- A1F8
        lda D0A4E             ; A1FE* AD 4E 0A
        beq LA20C             ; A201* F0 09
LA203:    ; <- A1F4 A1FC
        stx exit_dir          ; A203* 8E 05 0A
        lda #$00              ; A206* A9 00
        sta game_active       ; A208* 8D 04 0A
        rts                   ; A20B* 60
LA20C:    ; <- A201
        jsr jt_move_sprite    ; A20C* 20 03 9C
        lda player_col        ; A20F* AD 10 0A
        sta last_col          ; A212* 8D 0B 0A
        lda player_row        ; A215* AD 18 0A
        sta last_row          ; A218* 8D 0C 0A
        rts                   ; A21B* 60
leap_step:    ; <- A073
        lda #$04              ; A21C* A9 04
        sta step_period       ; A21E* 8D 06 0A
        ldx #$DC              ; A221* A2 DC
        lda facing            ; A223* AD 37 0A
        bmi LA22A             ; A226* 30 02
        ldx #$E0              ; A228* A2 E0
LA22A:    ; <- A226
        jsr set_sprite_pair   ; A22A* 20 F5 A3
        lda leap_phase        ; A22D* AD 31 0A
        cmp #$01              ; A230* C9 01
        beq LA24F             ; A232* F0 1B
        lda tile_below        ; A234* AD 23 0A
        jsr jt_tile_props     ; A237* 20 09 9C
        lda tp_solid          ; A23A* AD 2D 0A
        beq LA24F             ; A23D* F0 10
        lda #$00              ; A23F* A9 00
        sta leaping           ; A241* 8D 30 0A
        jsr jt_draw_player    ; A244* 20 0F 9C
        ldx #$02              ; A247* A2 02
        jsr jt_sfx            ; A249* 20 06 A8
        jmp state_step        ; A24C* 4C 2D A0
LA24F:    ; <- A232 A23D
        clc                   ; A24F* 18
        lda facing            ; A250* AD 37 0A
        adc player_col        ; A253* 6D 10 0A
        sta player_col        ; A256* 8D 10 0A
        ldx leap_phase        ; A259* AE 31 0A
        cpx #$03              ; A25C* E0 03
        bne LA264             ; A25E* D0 04
        dec leap_hover        ; A260* C6 C9
        bne LA285             ; A262* D0 21
LA264:    ; <- A25E
        lda leap_dy,x         ; A264* BD A3 A2
        clc                   ; A267* 18
        adc player_row        ; A268* 6D 18 0A
        sta player_row        ; A26B* 8D 18 0A
        inx                   ; A26E* E8
        stx leap_phase        ; A26F* 8E 31 0A
        cpx #$04              ; A272* E0 04
        bcs LA288             ; A274* B0 12
LA276:    ; <- A29C A2A1
        ldx leap_phase        ; A276* AE 31 0A
        cpx #$05              ; A279* E0 05
        bne LA285             ; A27B* D0 08
        lda #$00              ; A27D* A9 00
        sta leaping           ; A27F* 8D 30 0A
        jsr jt_draw_player    ; A282* 20 0F 9C
LA285:    ; <- A262 A27B
        jmp commit_step       ; A285* 4C B1 A1
LA288:    ; <- A274
        lda facing            ; A288* AD 37 0A
        bpl LA293             ; A28B* 10 06
        lda tile_dnleft       ; A28D* AD 24 0A
        jmp LA296             ; A290* 4C 96 A2
LA293:    ; <- A28B
        lda tile_dnright      ; A293* AD 25 0A
LA296:    ; <- A290
        jsr jt_tile_props     ; A296* 20 09 9C
        lda tp_solid          ; A299* AD 2D 0A
        beq LA276             ; A29C* F0 D8
        dec player_row        ; A29E  CE 18 0A
        jmp LA276             ; A2A1  4C 76 A2
        .byte $FF,$FF,$01,$01                         ; A2A4  ....
leap_start:    ; <- A0BA
        lda room_hi           ; A2A8* A5 87
        beq LA2B8             ; A2AA* F0 0C
        lda room_lo           ; A2AC  A5 86
        cmp #$80              ; A2AE  C9 80
        bcc LA2B8             ; A2B0  90 06
        jsr showing_climb_frame; A2B2  20 61 A3
        bcc LA2B8             ; A2B5  90 01
        rts                   ; A2B7  60
LA2B8:    ; <- A2AA A2B0 A2B5
        lda #$06              ; A2B8* A9 06
        sta step_period       ; A2BA* 8D 06 0A
        lda #$01              ; A2BD* A9 01
        sta leaping           ; A2BF* 8D 30 0A
        sta leap_phase        ; A2C2* 8D 31 0A
        sta running           ; A2C5* 8D 3C 0A
        lda #$00              ; A2C8* A9 00
        sta crawling          ; A2CA* 8D 3D 0A
        ldx #$DA              ; A2CD* A2 DA
        lda facing            ; A2CF* AD 37 0A
        bmi LA2D6             ; A2D2* 30 02
        ldx #$DE              ; A2D4* A2 DE
LA2D6:    ; <- A2D2
        stx DC3F8             ; A2D6* 8E F8 C3
        inx                   ; A2D9* E8
        stx DC3F9             ; A2DA* 8E F9 C3
        ldx #$06              ; A2DD* A2 06
        jsr jt_sfx            ; A2DF* 20 06 A8
        ldx #$05              ; A2E2* A2 05
        jsr spend_fatigue     ; A2E4* 20 80 9F
        ldx #$03              ; A2E7* A2 03
        lda stamina           ; A2E9* AD 66 0A
        cmp #$1E              ; A2EC* C9 1E
        bcs LA2F6             ; A2EE* B0 06
        dex                   ; A2F0* CA
        cmp #$14              ; A2F1* C9 14
        bcs LA2F6             ; A2F3* B0 01
        dex                   ; A2F5  CA
LA2F6:    ; <- A2EE A2F3
        stx leap_hover        ; A2F6* 86 C9
        jmp commit_step       ; A2F8* 4C B1 A1
knockdown_anim:    ; <- A06B
        inc knockdown_ctr     ; A2FB* EE 34 0A
        lda knockdown_ctr     ; A2FE* AD 34 0A
        cmp #$0A              ; A301* C9 0A
        beq LA32A             ; A303* F0 25
        cmp #$0B              ; A305* C9 0B
        beq LA319             ; A307* F0 10
        lda knockdown_frame   ; A309* AD 3A 0A
        eor #$01              ; A30C* 49 01
        sta knockdown_frame   ; A30E* 8D 3A 0A
        tay                   ; A311* A8
        ldx knockdown_frames,y; A312* BE 37 A3
        jsr set_sprite_pair   ; A315* 20 F5 A3
        rts                   ; A318* 60
LA319:    ; <- A307
        lda #$00              ; A319* A9 00
        sta knockdown_ctr     ; A31B* 8D 34 0A
        lda #$08              ; A31E* A9 08
        sta step_period       ; A320* 8D 06 0A
        jsr jt_draw_player    ; A323* 20 0F 9C
        jsr jt_clear_text_rows; A326* 20 06 95
        rts                   ; A329* 60
LA32A:    ; <- A303
        ldx #$DA              ; A32A* A2 DA
        lda facing            ; A32C* AD 37 0A
        bmi LA333             ; A32F* 30 02
        ldx #$DE              ; A331* A2 DE
LA333:    ; <- A32F
        jsr set_sprite_pair   ; A333* 20 F5 A3
        rts                   ; A336* 60
knockdown_frames:    ; <- A312
        .byte $E2,$E4                                 ; A337  ..
knockdown_start:    ; <- A051
        lda #$01              ; A339* A9 01
        sta knockdown_ctr     ; A33B* 8D 34 0A
        ldx #$E2              ; A33E* A2 E2
        jsr set_sprite_pair   ; A340* 20 F5 A3
        lda #$00              ; A343* A9 00
        sta fall_rows         ; A345* 8D 09 0A
        sta no_glide          ; A348* 8D 4C 0A
        jsr clear_move_states ; A34B* 20 75 A5
        lda #$0F              ; A34E* A9 0F
        sta step_period       ; A350* 8D 06 0A
        ldx #$07              ; A353* A2 07
        jsr jt_sfx            ; A355* 20 06 A8
        ldx #$40              ; A358* A2 40
        jsr spend_fatigue     ; A35A* 20 80 9F
        jsr L8F20             ; A35D* 20 20 8F
        rts                   ; A360* 60
showing_climb_frame:    ; <- A0AF A2B2
        lda DC3F8             ; A361* AD F8 C3
        cmp #$D4              ; A364* C9 D4
        bcc LA36E             ; A366* 90 06
        cmp #$D8              ; A368* C9 D8
        bcs LA36E             ; A36A* B0 02
        sec                   ; A36C* 38
        rts                   ; A36D* 60
LA36E:    ; <- A366 A36A
        clc                   ; A36E  18
        rts                   ; A36F  60
try_glide:    ; <- A099
        ldx #$13              ; A370* A2 13
LA372:    ; <- A37B
        lda obj_class_shuba,x ; A372* BD 58 0F
        bit obj_bit_carried   ; A375* 2C A5 0A
        bne LA380             ; A378* D0 06
        dex                   ; A37A* CA
        bpl LA372             ; A37B* 10 F5
        jmp input_nofire      ; A37D  4C E7 A0
LA380:    ; <- A378
        lda #$01              ; A380* A9 01
        sta gliding           ; A382* 8D 35 0A
        jsr set_glide_sprite  ; A385* 20 EC A3
        lda #$00              ; A388* A9 00
        sta fall_rows         ; A38A* 8D 09 0A
        sta crawling          ; A38D* 8D 3D 0A
        lda #$08              ; A390* A9 08
        sta step_period       ; A392* 8D 06 0A
        ldx #$08              ; A395* A2 08
        jsr jt_sfx            ; A397* 20 06 A8
glide_step:    ; <- A07B
        lda tile_at           ; A39A* AD 20 0A
        jsr jt_tile_props     ; A39D* 20 09 9C
        lda tp_solid          ; A3A0* AD 2D 0A
        beq LA3BA             ; A3A3* F0 15
        dec player_row        ; A3A5  CE 18 0A
; resting pose, sfx 2, then commit_step
glide_end:    ; <- A3C3
        lda #$00              ; A3A8* A9 00
        sta gliding           ; A3AA* 8D 35 0A
        jsr jt_draw_player    ; A3AD* 20 0F 9C
        ldx #$02              ; A3B0* A2 02
        jsr jt_sfx            ; A3B2* 20 06 A8
        bcc LA3B7             ; A3B5* 90 00
LA3B7:    ; <- A3B5
        jmp commit_step       ; A3B7* 4C B1 A1
LA3BA:    ; <- A3A3
        lda tile_below        ; A3BA* AD 23 0A
        jsr jt_tile_props     ; A3BD* 20 09 9C
        lda tp_solid          ; A3C0* AD 2D 0A
        bne glide_end         ; A3C3* D0 E3
        jsr jt_get_input      ; A3C5* 20 0F 80
        lda in_dx             ; A3C8* A5 98
        beq LA3DC             ; A3CA* F0 10
        cmp facing            ; A3CC* CD 37 0A
        beq LA3DC             ; A3CF* F0 0B
        sta facing            ; A3D1* 8D 37 0A
        jsr set_glide_sprite  ; A3D4* 20 EC A3
        ldx #$0B              ; A3D7* A2 0B
        jsr jt_sfx            ; A3D9* 20 06 A8
LA3DC:    ; <- A3CA A3CF
        lda facing            ; A3DC* AD 37 0A
        clc                   ; A3DF* 18
        adc player_col        ; A3E0* 6D 10 0A
        sta player_col        ; A3E3* 8D 10 0A
        inc player_row        ; A3E6* EE 18 0A
        jmp commit_step       ; A3E9* 4C B1 A1
set_glide_sprite:    ; <- A385 A3D4
        ldx #$D0              ; A3EC* A2 D0
        lda facing            ; A3EE* AD 37 0A
        bmi set_sprite_pair   ; A3F1* 30 02
        ldx #$D2              ; A3F3* A2 D2
set_sprite_pair:    ; <- A22A A315 A333 A340 A3F1 A410 A4E7 A4F9
        stx DC3F8             ; A3F5* 8E F8 C3
        inx                   ; A3F8* E8
        stx DC3F9             ; A3F9* 8E F9 C3
        rts                   ; A3FC* 60
stoop_pose:    ; <- A159 A195 A4CD
        lda #$01              ; A3FD* A9 01
        sta stooping          ; A3FF* 8D 3E 0A
        lda #$05              ; A402* A9 05
        sta step_period       ; A404* 8D 06 0A
        ldx #$DA              ; A407* A2 DA
        ldy facing            ; A409* AC 37 0A
        bmi LA410             ; A40C* 30 02
        ldx #$DE              ; A40E* A2 DE
LA410:    ; <- A40C
        jsr set_sprite_pair   ; A410* 20 F5 A3
        rts                   ; A413* 60
end_stoop_pose:    ; <- A040
        lda #$00              ; A414* A9 00
        sta stooping          ; A416* 8D 3E 0A
        jsr jt_draw_player    ; A419* 20 0F 9C
        rts                   ; A41C* 60
walk_step:    ; <- A063 A13A
        ldx walk_phase        ; A41D* AE 38 0A
        lda walk_next_phase,x ; A420* BD 9C A4
        sta walk_phase        ; A423* 8D 38 0A
        lda crawling          ; A426* AD 3D 0A
        beq LA437             ; A429* F0 0C
        lda crawl_period,x    ; A42B* BD A2 A4
        sta step_period       ; A42E* 8D 06 0A
        lda crawl_sprite,x    ; A431* BD A6 A4
        jmp LA448             ; A434* 4C 48 A4
LA437:    ; <- A429
        lda walk_period,x     ; A437* BD 9E A4
        ldy running           ; A43A* AC 3C 0A
        beq LA442             ; A43D* F0 03
        lda run_period,x      ; A43F* BD A0 A4
LA442:    ; <- A43D
        sta step_period       ; A442* 8D 06 0A
        lda walk_sprite,x     ; A445* BD A4 A4
LA448:    ; <- A434
        ldx facing            ; A448* AE 37 0A
        bmi LA450             ; A44B* 30 03
        clc                   ; A44D* 18
        adc #$06              ; A44E* 69 06
LA450:    ; <- A44B
        ldx walk_phase        ; A450* AE 38 0A
        beq LA459             ; A453* F0 04
        clc                   ; A455* 18
        adc walk_frame        ; A456* 6D 39 0A
LA459:    ; <- A453
        sta DC3F8             ; A459* 8D F8 C3
        sta DC3F9             ; A45C* 8D F9 C3
        inc DC3F9             ; A45F* EE F9 C3
        lda walk_phase        ; A462* AD 38 0A
        bne LA496             ; A465* D0 2F
        clc                   ; A467* 18
        lda facing            ; A468* AD 37 0A
        adc player_col        ; A46B* 6D 10 0A
        sta player_col        ; A46E* 8D 10 0A
        lda facing            ; A471* AD 37 0A
        bpl LA47C             ; A474* 10 06
        lda tile_left         ; A476* AD 21 0A
        jmp LA47F             ; A479* 4C 7F A4
LA47C:    ; <- A474
        lda tile_right        ; A47C* AD 22 0A
LA47F:    ; <- A479
        jsr jt_tile_props     ; A47F* 20 09 9C
        lda tp_solid          ; A482* AD 2D 0A
        beq LA48A             ; A485* F0 03
        dec player_row        ; A487* CE 18 0A
LA48A:    ; <- A485
        ldx #$02              ; A48A* A2 02
        lda walk_frame        ; A48C* AD 39 0A
        bne LA493             ; A48F* D0 02
        ldx #$03              ; A491* A2 03
LA493:    ; <- A48F
        jsr jt_sfx            ; A493* 20 06 A8
LA496:    ; <- A465
        jsr check_spirit_bell ; A496* 20 B3 9F
        jmp commit_step       ; A499* 4C B1 A1
walk_next_phase:    ; <- A420
        .byte $01,$00                                 ; A49C  ..
walk_period:    ; <- A437
        .byte $06,$04                                 ; A49E  ..
run_period:    ; <- A43F
        .byte $03,$02                                 ; A4A0  ..
crawl_period:    ; <- A42B
        .byte $08,$08                                 ; A4A2  ..
walk_sprite:    ; <- A445
        .byte $C6,$C4                                 ; A4A4  ..
crawl_sprite:    ; <- A431
        .byte $E8,$E6                                 ; A4A6  ..
climb_step:    ; <- A17D
        lda #$00              ; A4A8* A9 00
        sta running           ; A4AA* 8D 3C 0A
        sta crawling          ; A4AD* 8D 3D 0A
        lda player_row        ; A4B0* AD 18 0A
        bmi LA50C             ; A4B3* 30 57
        beq LA4ED             ; A4B5* F0 36
        cmp #$13              ; A4B7* C9 13
        beq LA50C             ; A4B9* F0 51
        lda tile_up1          ; A4BB* AD 26 0A
        ldx in_dy             ; A4BE* A6 99
        bmi LA4C5             ; A4C0* 30 03
        lda tile_below        ; A4C2  AD 23 0A
LA4C5:    ; <- A4C0
        jsr jt_tile_props     ; A4C5* 20 09 9C
        lda tp_climb          ; A4C8* AD 2E 0A
        bne LA4D3             ; A4CB* D0 06
        jsr stoop_pose        ; A4CD* 20 FD A3
        jmp commit_step       ; A4D0* 4C B1 A1
LA4D3:    ; <- A4CB
        lda tile_up2          ; A4D3* AD 27 0A
        ldx in_dy             ; A4D6* A6 99
        bmi LA4DD             ; A4D8* 30 03
        lda tile_at           ; A4DA  AD 20 0A
LA4DD:    ; <- A4D8
        jsr jt_tile_props     ; A4DD* 20 09 9C
        lda tp_climb          ; A4E0* AD 2E 0A
        bne LA4ED             ; A4E3* D0 08
        ldx #$D8              ; A4E5* A2 D8
        jsr set_sprite_pair   ; A4E7* 20 F5 A3
        jmp commit_step       ; A4EA* 4C B1 A1
LA4ED:    ; <- A4B5 A4E3
        lda climb_frame       ; A4ED* AD 3B 0A
        eor #$01              ; A4F0* 49 01
        sta climb_frame       ; A4F2* 8D 3B 0A
        tay                   ; A4F5* A8
        ldx climb_frames,y    ; A4F6* BE 0F A5
        jsr set_sprite_pair   ; A4F9* 20 F5 A3
        ldx #$04              ; A4FC* A2 04
        lda in_dy             ; A4FE* A5 99
        bmi LA504             ; A500* 30 02
        ldx #$05              ; A502  A2 05
LA504:    ; <- A500
        jsr jt_sfx            ; A504* 20 06 A8
        ldx #$01              ; A507* A2 01
        jsr spend_fatigue     ; A509* 20 80 9F
LA50C:    ; <- A4B3 A4B9
        jmp commit_step       ; A50C* 4C B1 A1
climb_frames:    ; <- A4F6
        .byte $D4,$D6                                 ; A50F  ..
check_blocked_tile:    ; <- A1B6
        jsr jt_sample_neighbors; A511* 20 00 9C
        lda tile_at           ; A514* AD 20 0A
        cmp #$1C              ; A517* C9 1C
        beq LA51C             ; A519* F0 01
LA51B:    ; <- A521 A526
        rts                   ; A51B* 60
LA51C:    ; <- A519
        lda fall_rows         ; A51C  AD 09 0A
        cmp #$02              ; A51F  C9 02
        bcs LA51B             ; A521  B0 F8
        lda gliding           ; A523  AD 35 0A
        bne LA51B             ; A526  D0 F3
        lda last_col          ; A528  AD 0B 0A
        sta player_col        ; A52B  8D 10 0A
        lda last_row          ; A52E  AD 0C 0A
        sta player_row        ; A531  8D 18 0A
        lda #$0A              ; A534  A9 0A
        sta fall_rows         ; A536  8D 09 0A
        jsr clear_move_states ; A539  20 75 A5
        rts                   ; A53C  60
; wall in the body or head cell: revert and request a knock-down
check_wall_hit:    ; <- A1B9
        lda tile_at           ; A53D* AD 20 0A
        jsr is_wall_tile      ; A540* 20 87 A5
        beq LA553             ; A543* F0 0E
        lda crawling          ; A545* AD 3D 0A
        beq LA54B             ; A548* F0 01
LA54A:    ; <- A551
        rts                   ; A54A* 60
LA54B:    ; <- A548
        lda tile_head         ; A54B* AD 28 0A
        jsr is_wall_tile      ; A54E* 20 87 A5
        bne LA54A             ; A551* D0 F7
LA553:    ; <- A543
        lda last_col          ; A553* AD 0B 0A
        sta player_col        ; A556* 8D 10 0A
        lda last_row          ; A559* AD 0C 0A
        sta player_row        ; A55C* 8D 18 0A
        lda #$00              ; A55F* A9 00
        sta leaping           ; A561* 8D 30 0A
        sta gliding           ; A564* 8D 35 0A
        jsr jt_draw_player    ; A567* 20 0F 9C
        lda #$0A              ; A56A* A9 0A
        sta fall_rows         ; A56C* 8D 09 0A
        lda #$01              ; A56F* A9 01
        sta no_glide          ; A571* 8D 4C 0A
        rts                   ; A574* 60
clear_move_states:    ; <- A34B A539
        lda #$00              ; A575* A9 00
        sta leaping           ; A577* 8D 30 0A
        sta gliding           ; A57A* 8D 35 0A
        sta walk_phase        ; A57D* 8D 38 0A
        sta running           ; A580* 8D 3C 0A
        sta crawling          ; A583* 8D 3D 0A
        rts                   ; A586* 60
; returns Z=1 for the wall tiles $07/$08/$52
is_wall_tile:    ; <- A540 A54E
        cmp #$07              ; A587* C9 07
        beq LA593             ; A589* F0 08
        cmp #$08              ; A58B* C9 08
        beq LA593             ; A58D* F0 04
        cmp #$52              ; A58F* C9 52
        beq LA593             ; A591* F0 00
LA593:    ; <- A589 A58D A591
        rts                   ; A593* 60
request_door:    ; <- A0E4
        sec                   ; A594  38
        sbc #$B9              ; A595  E9 B9
        sta door_req          ; A597  8D 0D 0A
        lda #$00              ; A59A  A9 00
        sta game_active       ; A59C  8D 04 0A
        ldx #$0A              ; A59F  A2 0A
        jsr jt_sfx            ; A5A1  20 06 A8
        rts                   ; A5A4  60
        .byte $8D,$0D,$0A,$A9,$00,$8D,$04,$0A,$A2,$0A,$20,$06,$A8,$60,$00,$00; A5A5  .......... ..`..
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A5B5  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A5C5  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A5D5  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A5E5  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A5F5  ...........
jt_room_is_outdoor:    ; <- 9446 966C
        jmp room_is_outdoor   ; A600* 4C 94 A6
jt_return_home:    ; <- 948A B339 B395
        jmp return_to_nid     ; A603  4C FB A6
jt_drowned:    ; <- 9580
        jmp drowned_home      ; A606  4C 0C A6
jt_verb_renew:    ; <- A921
        jmp verb_renew        ; A609  4C 4C A6
drowned_home:    ; <- A606
        jsr return_to_nid     ; A60C  20 FB A6
        lda #$04              ; A60F  A9 04
        sta D0A4B             ; A611  8D 4B 0A
        jsr print_inline      ; A614  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$57,$45,$52,$45,$20,$46,$4F,$55,$4E,$44; A617  I.YOU WERE FOUND
        .byte $20,$4E,$45,$41,$52,$20,$54,$48,$45,$20,$57,$41,$54,$45,$52,$2E; A627   NEAR THE WATER.
        .byte $FF                                     ; A637  .
        jsr print_time_has_passed; A638  20 7D A6
        jsr jt_verb_done      ; A63B  20 12 AC
        jsr jt_draw_player    ; A63E  20 0F 9C
        lda #$00              ; A641  A9 00
        sta drowned           ; A643  8D 4D 0A
        lda #$01              ; A646  A9 01
        sta game_active       ; A648  8D 04 0A
        rts                   ; A64B  60
verb_renew:    ; <- A609
        jsr jt_clear_text_rows; A64C  20 06 95
        jsr return_to_nid     ; A64F  20 FB A6
        jsr print_inline      ; A652  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$57,$45,$52,$45,$20,$46,$4F,$55,$4E,$44; A655  I.YOU WERE FOUND
        .byte $20,$55,$4E,$43,$4F,$4E,$53,$43,$49,$4F,$55,$53,$2E,$FF; A665   UNCONSCIOUS..
        jsr print_time_has_passed; A673  20 7D A6
        jsr jt_verb_done      ; A676  20 12 AC
        jsr jt_draw_player    ; A679  20 0F 9C
        rts                   ; A67C  60
print_time_has_passed:    ; <- A638 A673
        jsr print_inline      ; A67D  20 09 80
        .byte $71,$C3,$54,$49,$4D,$45,$20,$48,$41,$53,$20,$50,$41,$53,$53,$45; A680  q.TIME HAS PASSE
        .byte $44,$2E,$FF                             ; A690  D..
        rts                   ; A693  60
room_is_outdoor:    ; <- A600
        lda room_hi           ; A694* A5 87
        sta $80               ; A696* 85 80
        lda room_lo           ; A698* A5 86
        ldx #$03              ; A69A* A2 03
LA69C:    ; <- A6A0
        lsr $80               ; A69C* 46 80
        ror a                 ; A69E* 6A
        dex                   ; A69F* CA
        bne LA69C             ; A6A0* D0 FA
        tax                   ; A6A2* AA
        lda outdoor_bitmap,x  ; A6A3* BD BB A6
        sta $80               ; A6A6* 85 80
        lda room_lo           ; A6A8* A5 86
        and #$07              ; A6AA* 29 07
        tax                   ; A6AC* AA
        lda DA6B3,x           ; A6AD* BD B3 A6
        bit $80               ; A6B0* 24 80
        rts                   ; A6B2* 60
DA6B3:    ; <- A6AD
        .byte $80,$40,$20,$10,$08,$04,$02,$01         ; A6B3  .@ .....
outdoor_bitmap:    ; <- A6A3
        .byte $70,$01,$80,$00,$70,$01,$80,$00,$70,$03,$80,$60,$F0,$1B,$80,$70; A6BB  p...p...p..`...p
        .byte $F7,$FF,$C0,$78,$FF,$FF,$FF,$FC,$FB,$FF,$F7,$FC,$FF,$FF,$FF,$FF; A6CB  ...x............
        .byte $FF,$FF,$FF,$7F,$7B,$FF,$F7,$7C,$23,$31,$17,$7C,$FF,$FF,$FF,$FF; A6DB  ....{..|#1.|....
        .byte $FF,$9F,$F9,$FE,$FE,$DD,$FF,$5B,$FB,$FF,$11,$FF,$03,$F0,$3C,$00; A6EB  .......[......<.
; day +1, spirit refilled, food and rest both refilled to $0A6A - 1
return_to_nid:    ; <- A603 A60C A64F
        lda nid_room_lo       ; A6FB  AD 6D 0A
        sta room_lo           ; A6FE  85 86
        lda nid_room_hi       ; A700  AD 6E 0A
        sta room_hi           ; A703  85 87
        lda #$01              ; A705  A9 01
        sta indoor_flag       ; A707  8D 0E 0A
        jsr L8803             ; A70A  20 03 88
        lda nid_col           ; A70D  AD 6F 0A
        sta player_col        ; A710  8D 10 0A
        lda nid_row           ; A713  AD 70 0A
        sta player_row        ; A716  8D 18 0A
        ldx #$F2              ; A719  A2 F2
        stx DC3F8             ; A71B  8E F8 C3
        inx                   ; A71E  E8
        stx DC3F9             ; A71F  8E F9 C3
        jsr jt_move_sprite    ; A722  20 03 9C
        lda #$03              ; A725  A9 03
        sta $D015             ; A727  8D 15 D0
        inc day               ; A72A  EE 62 0A
        ldx spirit_limit      ; A72D  AE 67 0A
        stx spirit_energy     ; A730  8E 63 0A
        ldx food_max1         ; A733  AE 6A 0A
        dex                   ; A736  CA
        stx food              ; A737  8E 64 0A
        stx rest              ; A73A  8E 65 0A
        rts                   ; A73D  60
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A73E  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A74E  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A75E  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A76E  ................
        .byte $00,$00                                 ; A77E  ..
item_name_ofs:    ; <- AFD4
        .byte $00,$10,$20,$30,$40,$50,$60,$70,$80,$90,$A0,$B0,$C0,$D0,$E0,$F0; A780  .. 0@P`p........
; A = object number -> Y = class 0-14; $FF matches nothing
object_class_of:    ; <- AC09 AD5D AF39 AFAE
        ldy #$00              ; A790* A0 00
LA792:    ; <- A79E
        cmp object_class_ranges,y; A792* D9 A0 A7
        bcc LA79D             ; A795* 90 06
        cmp DA7A1,y           ; A797* D9 A1 A7
        bcs LA79D             ; A79A* B0 01
        rts                   ; A79C* 60
LA79D:    ; <- A795 A79A
        iny                   ; A79D* C8
        bne LA792             ; A79E* D0 F2
object_class_ranges:    ; <- A792
        brk                   ; A7A0  00
DA7A1:    ; <- A797
        .byte $01,$02,$1B,$1C,$26,$3F,$58,$6C,$B7,$D0,$DA,$F8,$F9,$FA,$FF,$E6; A7A1  ....&?Xl........
        .byte $FF                                     ; A7B1  .
verb_done:    ; <- AC12 AC6E ACD7 ACE4 AD4F ADB5 ADF4 AE11 AE2F AFA5 AFC6
        jsr jt_wait_input     ; A7B2  20 27 80
LA7B5:    ; <- A7BC
        jsr jt_get_input      ; A7B5  20 0F 80
        bne LA7BE             ; A7B8  D0 04
        lda in_ndirs          ; A7BA  A5 9A
        beq LA7B5             ; A7BC  F0 F7
LA7BE:    ; <- A7B8
        jmp jt_clear_text_rows; A7BE  4C 06 95
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A7C1  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A7D1  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A7E1  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; A7F1  ...............
jt_tool_menu:    ; <- 9520
        jmp tool_menu         ; A800* 4C 1B A8
jt_set_panel_color:    ; <- 342C 953C
        jmp set_panel_color   ; A803* 4C 33 A9
jt_sfx:    ; <- 3474 368C 3888 38F3 3943 878A 91BC 9385 9FCE A056 A100 A249 A2DF A355 A397 A3B2 A3D9 A493 A504 A5A1 ACF9 AD01 AD0D
        jmp sfx_play          ; A806* 4C 40 AA
LA809:    ; <- ACBD
        jmp rest_steal_tokens ; A809  4C AB AA
LA80C:    ; <- ACC7
        jmp rest_steal_shubas ; A80C  4C C3 AA
LA80F:    ; <- ACD4
        jmp rest_wake_room_1c ; A80F  4C DB AA
LA812:    ; <- ACE1
        jmp rest_wake_room_3b ; A812  4C 45 AB
LA815:    ; <- 95B3
        jmp creature_hit_effect; A815  4C 20 B3
LA818:    ; <- 42B2 4453 837C 9068 AF47 B48D
        jmp cycle_click       ; A818  4C 2D AA
; tool_menu: 4x5 verb grid over $C348-$C3E7; $0A04 stays 0 throughout
tool_menu:    ; <- A800
        lda #$0F              ; A81B* A9 0F
        sta $D418             ; A81D* 8D 18 D4
        jsr tool_menu_draw    ; A820* 20 3C A9
        lda #$00              ; A823* A9 00
        sta menu_col          ; A825* 8D 50 0A
        sta menu_row          ; A828* 8D 51 0A
        sta menu_col_new      ; A82B* 8D 52 0A
        sta menu_row_new      ; A82E* 8D 53 0A
        sta menu_req          ; A831* 8D 4A 0A
        jsr tool_menu_hilite  ; A834* 20 FF A9
LA837:    ; <- A91E A930
        jsr jt_wait_input     ; A837* 20 27 80
LA83A:    ; <- A849 A877 A895
        jsr jt_get_input      ; A83A* 20 0F 80
        beq LA847             ; A83D* F0 08
        ldx #$01              ; A83F* A2 01
        jsr sfx_play          ; A841* 20 40 AA
        jmp tool_menu_dispatch; A844* 4C 98 A8
LA847:    ; <- A83D
        lda in_ndirs          ; A847* A5 9A
        beq LA83A             ; A849* F0 EF
        lda #$00              ; A84B* A9 00
        sta $84               ; A84D* 85 84
        clc                   ; A84F* 18
        lda in_dx             ; A850* A5 98
        beq LA862             ; A852* F0 0E
        adc menu_col_new      ; A854* 6D 52 0A
        bmi LA862             ; A857* 30 09
        cmp #$05              ; A859* C9 05
        beq LA862             ; A85B* F0 05
        sta menu_col_new      ; A85D* 8D 52 0A
        inc $84               ; A860* E6 84
LA862:    ; <- A852 A857 A85B
        clc                   ; A862* 18
        lda in_dy             ; A863* A5 99
        beq LA875             ; A865* F0 0E
        adc menu_row_new      ; A867  6D 53 0A
        bmi LA875             ; A86A  30 09
        cmp #$04              ; A86C  C9 04
        beq LA875             ; A86E  F0 05
        sta menu_row_new      ; A870  8D 53 0A
        inc $84               ; A873  E6 84
LA875:    ; <- A865 A86A A86E
        lda $84               ; A875* A5 84
        beq LA83A             ; A877* F0 C1
        jsr tool_menu_unhilite; A879* 20 0F AA
        lda menu_col_new      ; A87C* AD 52 0A
        sta menu_col          ; A87F* 8D 50 0A
        lda menu_row_new      ; A882* AD 53 0A
        sta menu_row          ; A885* 8D 51 0A
        jsr tool_menu_hilite  ; A888* 20 FF A9
        ldx #$00              ; A88B* A2 00
        jsr sfx_play          ; A88D* 20 40 AA
        ldx #$60              ; A890* A2 60
        jsr jt_delay          ; A892* 20 12 80
        jmp LA83A             ; A895* 4C 3A A8
; dispatch on $0A50 (col 0-4) / $0A51 (row 0-3); see docs/verbs-and-inventory.md
tool_menu_dispatch:    ; <- A844
        lda menu_col          ; A898* AD 50 0A
        bne LA8B7             ; A89B* D0 1A
        lda menu_row          ; A89D  AD 51 0A
        bne LA8A6             ; A8A0  D0 04
        jsr jt_clear_text_rows; A8A2  20 06 95
        rts                   ; A8A5  60
LA8A6:    ; <- A8A0
        cmp #$01              ; A8A6  C9 01
        bne LA8AD             ; A8A8  D0 03
        jmp jt_verb_speak     ; A8AA  4C 03 3C
LA8AD:    ; <- A8A8
        cmp #$02              ; A8AD  C9 02
        bne LA8B4             ; A8AF  D0 03
        jmp jt_verb_pense     ; A8B1  4C 06 3C
LA8B4:    ; <- A8AF
        jmp jt_verb_offer     ; A8B4  4C 0F 3C
LA8B7:    ; <- A89B
        cmp #$01              ; A8B7* C9 01
        bne LA8D4             ; A8B9* D0 19
        lda menu_row          ; A8BB  AD 51 0A
        bne LA8C3             ; A8BE  D0 03
        jmp jt_verb_take      ; A8C0  4C 03 AC
LA8C3:    ; <- A8BE
        cmp #$01              ; A8C3  C9 01
        bne LA8CA             ; A8C5  D0 03
        jmp jt_verb_buy       ; A8C7  4C 09 3C
LA8CA:    ; <- A8C5
        cmp #$02              ; A8CA  C9 02
        bne LA8D1             ; A8CC  D0 03
        jmp verb_use          ; A8CE  4C 00 90
LA8D1:    ; <- A8CC
        jmp jt_verb_eat       ; A8D1  4C 00 B4
LA8D4:    ; <- A8B9
        cmp #$02              ; A8D4* C9 02
        bne LA8F1             ; A8D6* D0 19
        lda menu_row          ; A8D8  AD 51 0A
        bne LA8E0             ; A8DB  D0 03
        jmp jt_verb_drop      ; A8DD  4C 06 AC
LA8E0:    ; <- A8DB
        cmp #$01              ; A8E0  C9 01
        bne LA8E7             ; A8E2  D0 03
        jmp jt_verb_sell      ; A8E4  4C 0C 3C
LA8E7:    ; <- A8E2
        cmp #$02              ; A8E7  C9 02
        bne LA8EE             ; A8E9  D0 03
        jmp jt_verb_heal      ; A8EB  4C 06 84
LA8EE:    ; <- A8E9
        jmp jt_verb_rest      ; A8EE  4C 00 AC
LA8F1:    ; <- A8D6
        cmp #$03              ; A8F1* C9 03
        bne LA90E             ; A8F3* D0 19
        lda menu_row          ; A8F5  AD 51 0A
        bne LA8FD             ; A8F8  D0 03
        jmp jt_verb_examine   ; A8FA  4C 03 B4
LA8FD:    ; <- A8F8
        cmp #$01              ; A8FD  C9 01
        bne LA904             ; A8FF  D0 03
        jmp jt_verb_inventory ; A901  4C 03 84
LA904:    ; <- A8FF
        cmp #$02              ; A904  C9 02
        bne LA90B             ; A906  D0 03
        jmp jt_verb_grunspreke; A908  4C 09 84
LA90B:    ; <- A906
        jmp jt_verb_kiniport  ; A90B  4C 0C 84
LA90E:    ; <- A8F3
        lda menu_row          ; A90E* AD 51 0A
        bne LA916             ; A911* D0 03
        jmp jt_verb_status    ; A913* 4C 00 B1
LA916:    ; <- A911
        cmp #$01              ; A916  C9 01
        bne LA924             ; A918  D0 0A
        lda dream_state       ; A91A  A5 C8
        beq LA921             ; A91C  F0 03
        jmp LA837             ; A91E  4C 37 A8
LA921:    ; <- A91C
        jmp jt_verb_renew     ; A921  4C 09 A6
LA924:    ; <- A918
        cmp #$02              ; A924  C9 02
        bne LA930             ; A926  D0 08
        jsr jt_clear_text_rows; A928  20 06 95
        pla                   ; A92B  68
        pla                   ; A92C  68
        jmp jt_main_menu      ; A92D  4C 00 34
LA930:    ; <- A926
        jmp LA837             ; A930  4C 37 A8
; A = colour for $DB48-$DBE7, the 4-line text panel
set_panel_color:    ; <- A803 A93E
        ldx #$A0              ; A933* A2 A0
LA935:    ; <- A939
        sta $DB47,x           ; A935* 9D 47 DB
        dex                   ; A938* CA
        bne LA935             ; A939* D0 FA
        rts                   ; A93B* 60
tool_menu_draw:    ; <- A820
        lda #$01              ; A93C* A9 01
        jsr set_panel_color   ; A93E* 20 33 A9
        ldx #$A0              ; A941* A2 A0
LA943:    ; <- A94A
        lda LA94C,x           ; A943* BD 4C A9
        sta DC347,x           ; A946* 9D 47 C3
        dex                   ; A949* CA
        bne LA943             ; A94A* D0 F7
LA94C:    ; <- A943
        rts                   ; A94C* 60
tool_menu_text:
        .byte $20,$50,$41,$55,$53,$45,$20,$20,$54,$41,$4B,$45,$20,$20,$44,$52; A94D   PAUSE  TAKE  DR
        .byte $4F,$50,$20,$20,$45,$58,$41,$4D,$49,$4E,$45,$20,$20,$20,$20,$20; A95D  OP  EXAMINE     
        .byte $53,$54,$41,$54,$55,$53,$20,$20,$20,$53,$50,$45,$41,$4B,$20,$20; A96D  STATUS   SPEAK  
        .byte $42,$55,$59,$20,$20,$20,$53,$45,$4C,$4C,$20,$20,$49,$4E,$56,$45; A97D  BUY   SELL  INVE
        .byte $4E,$54,$4F,$52,$59,$20,$20,$20,$52,$45,$4E,$45,$57,$20,$20,$20; A98D  NTORY   RENEW   
        .byte $20,$50,$45,$4E,$53,$45,$20,$20,$55,$53,$45,$20,$20,$20,$48,$45; A99D   PENSE  USE   HE
        .byte $41,$4C,$20,$20,$47,$52,$55,$4E,$53,$50,$52,$45,$4B,$45,$20,$20; A9AD  AL  GRUNSPREKE  
        .byte $4D,$45,$4E,$55,$20,$20,$20,$20,$20,$4F,$46,$46,$45,$52,$20,$20; A9BD  MENU     OFFER  
        .byte $45,$41,$54,$20,$20,$20,$52,$45,$53,$54,$20,$20,$4B,$49,$4E,$49; A9CD  EAT   REST  KINI
        .byte $50,$4F,$52,$54,$20,$20,$20,$20,$20,$20,$20,$20,$20,$20,$20,$20; A9DD  PORT            
tool_menu_cell:    ; <- A9FF AA0F
        ldx menu_row          ; A9ED* AE 51 0A
        lda tool_menu_row_ofs,x; A9F0* BD 1F AA
        ldx menu_col          ; A9F3* AE 50 0A
        clc                   ; A9F6* 18
        adc tool_menu_col_ofs,x; A9F7* 7D 23 AA
        ldy tool_menu_col_len,x; A9FA* BC 28 AA
        tax                   ; A9FD* AA
        rts                   ; A9FE* 60
tool_menu_hilite:    ; <- A834 A888
        jsr tool_menu_cell    ; A9FF* 20 ED A9
LAA02:    ; <- AA0C
        lda DC348,x           ; AA02* BD 48 C3
        ora #$80              ; AA05* 09 80
        sta DC348,x           ; AA07* 9D 48 C3
        inx                   ; AA0A* E8
        dey                   ; AA0B* 88
        bne LAA02             ; AA0C* D0 F4
        rts                   ; AA0E* 60
tool_menu_unhilite:    ; <- A879
        jsr tool_menu_cell    ; AA0F* 20 ED A9
LAA12:    ; <- AA1C
        lda DC348,x           ; AA12* BD 48 C3
        and #$7F              ; AA15* 29 7F
        sta DC348,x           ; AA17* 9D 48 C3
        inx                   ; AA1A* E8
        dey                   ; AA1B* 88
        bne LAA12             ; AA1C* D0 F4
        rts                   ; AA1E* 60
tool_menu_row_ofs:    ; <- A9F0
        .byte $00,$28,$50,$78                         ; AA1F  .(Px
tool_menu_col_ofs:    ; <- A9F7
        .byte $00,$07,$0D,$13,$1F                     ; AA23  .....
tool_menu_col_len:    ; <- A9FA
        .byte $07,$06,$06,$0C,$08                     ; AA28  .....
cycle_click:    ; <- A818
        lda cycle_first       ; AA2D  A5 D2
        bmi LAA36             ; AA2F  30 05
        ldx #$00              ; AA31  A2 00
        jsr sfx_play          ; AA33  20 40 AA
LAA36:    ; <- AA2F
        ldx #$A0              ; AA36  A2 A0
        jsr jt_delay          ; AA38  20 12 80
        lda #$00              ; AA3B  A9 00
        sta cycle_first       ; AA3D  85 D2
        rts                   ; AA3F  60
; sfx_play: X = effect 0-13; returns immediately while music plays
sfx_play:    ; <- A806 A841 A88D AA33
        lda music_on          ; AA40* AD 95 0A
        beq LAA46             ; AA43* F0 01
        rts                   ; AA45* 60
LAA46:    ; <- AA43
        lda #$00              ; AA46* A9 00
        sta $D402             ; AA48* 8D 02 D4
        lda #$08              ; AA4B* A9 08
        sta $D403             ; AA4D* 8D 03 D4
        lda sfx_ad,x          ; AA50* BD 73 AA
        sta $D405             ; AA53* 8D 05 D4
        lda #$00              ; AA56* A9 00
        sta $D406             ; AA58* 8D 06 D4
        lda sfx_freq_lo,x     ; AA5B* BD 81 AA
        sta SID               ; AA5E* 8D 00 D4
        lda sfx_freq_hi,x     ; AA61* BD 8F AA
        sta $D401             ; AA64* 8D 01 D4
        lda #$00              ; AA67* A9 00
        sta $D404             ; AA69* 8D 04 D4
        lda sfx_ctrl,x        ; AA6C* BD 9D AA
        sta $D404             ; AA6F* 8D 04 D4
        rts                   ; AA72* 60
sfx_ad:    ; <- AA50
        .byte $02,$19,$01,$01,$34,$34,$87,$09,$9C,$DD,$19,$69,$17,$02; AA73  ....44.....i..
sfx_freq_lo:    ; <- AA5B
        .byte $0F,$63,$0F,$1E,$1E,$0F,$06,$BB,$83,$83,$C1,$83,$1E,$79; AA81  .c...........y
sfx_freq_hi:    ; <- AA61
        .byte $43,$38,$43,$86,$86,$43,$B3,$03,$59,$59,$2C,$59,$86,$64; AA8F  C8C..C..YY,Y.d
sfx_ctrl:    ; <- AA6C
        .byte $41,$41,$81,$81,$81,$81,$81,$41,$81,$81,$41,$81,$41,$41; AA9D  AA.....A..A.AA
rest_steal_tokens:    ; <- A809
        ldx #$4A              ; AAAB  A2 4A
LAAAD:    ; <- AAC0
        lda obj_class_token,x ; AAAD  BD 6C 0F
        bit obj_bit_carried   ; AAB0  2C A5 0A
        beq LAABF             ; AAB3  F0 0A
        lda #$00              ; AAB5  A9 00
        sta obj_class_token,x ; AAB7  9D 6C 0F
        ldy #$08              ; AABA  A0 08
        jsr jt_subtract_weight; AABC  20 0C AC
LAABF:    ; <- AAB3
        dex                   ; AABF  CA
        bpl LAAAD             ; AAC0  10 EB
        rts                   ; AAC2  60
rest_steal_shubas:    ; <- A80C
        ldx #$13              ; AAC3  A2 13
LAAC5:    ; <- AAD8
        lda obj_class_shuba,x ; AAC5  BD 58 0F
        bit obj_bit_carried   ; AAC8  2C A5 0A
        beq LAAD7             ; AACB  F0 0A
        lda #$00              ; AACD  A9 00
        sta obj_class_shuba,x ; AACF  9D 58 0F
        ldy #$07              ; AAD2  A0 07
        jsr jt_subtract_weight; AAD4  20 0C AC
LAAD7:    ; <- AACB
        dex                   ; AAD7  CA
        bpl LAAC5             ; AAD8  10 EB
        rts                   ; AADA  60
rest_wake_room_1c:    ; <- A80F B32B
        lda #$1C              ; AADB  A9 1C
        sta room_lo           ; AADD  85 86
        lda #$00              ; AADF  A9 00
        sta room_hi           ; AAE1  85 87
        lda #$01              ; AAE3  A9 01
        sta indoor_flag       ; AAE5  8D 0E 0A
        jsr L8803             ; AAE8  20 03 88
        lda #$15              ; AAEB  A9 15
        sta player_col        ; AAED  8D 10 0A
        lda #$0F              ; AAF0  A9 0F
        sta player_row        ; AAF2  8D 18 0A
        jsr print_inline      ; AAF5  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$57,$45,$52,$45,$20,$4B,$49,$44,$4E,$41; AAF8  I.YOU WERE KIDNA
        .byte $50,$50,$45,$44,$20,$42,$59,$20,$54,$48,$45,$20,$46,$4F,$4C,$4C; AB08  PPED BY THE FOLL
        .byte $4F,$57,$45,$52,$53,$20,$20,$20,$20,$20,$4F,$46,$20,$44,$27,$4F; AB18  OWERS     OF D'O
        .byte $4C,$20,$53,$41,$4C,$41,$41,$54,$FF     ; AB28  L SALAAT.
LAB31:    ; <- AB84
        lda #$00              ; AB31  A9 00
        sta crawling          ; AB33  8D 3D 0A
        sta leaping           ; AB36  8D 30 0A
        jsr jt_draw_player    ; AB39  20 0F 9C
        jsr jt_move_sprite    ; AB3C  20 03 9C
        lda #$03              ; AB3F  A9 03
        sta $D015             ; AB41  8D 15 D0
        rts                   ; AB44  60
rest_wake_room_3b:    ; <- A812 B38F
        lda #$3B              ; AB45  A9 3B
        sta room_lo           ; AB47  85 86
        lda #$00              ; AB49  A9 00
        sta room_hi           ; AB4B  85 87
        lda #$01              ; AB4D  A9 01
        sta indoor_flag       ; AB4F  8D 0E 0A
        jsr L8803             ; AB52  20 03 88
        lda #$13              ; AB55  A9 13
        sta player_col        ; AB57  8D 10 0A
        lda #$0F              ; AB5A  A9 0F
        sta player_row        ; AB5C  8D 18 0A
        jsr print_inline      ; AB5F  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$57,$45,$52,$45,$20,$4B,$49,$44,$4E,$41; AB62  I.YOU WERE KIDNA
        .byte $50,$50,$45,$44,$20,$42,$59,$20,$54,$48,$45,$20,$4E,$45,$4B,$4F; AB72  PPED BY THE NEKO
        .byte $4D,$FF                                 ; AB82  M.
        jmp LAB31             ; AB84  4C 31 AB
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; AB87  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; AB97  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; ABA7  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; ABB7  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; ABC7  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; ABD7  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; ABE7  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00     ; ABF7  .........
jt_verb_rest:    ; <- A8EE
        jmp verb_rest         ; AC00  4C 15 AC
jt_verb_take:    ; <- A8C0
        jmp verb_take         ; AC03  4C 52 AD
jt_verb_drop:    ; <- A8DD
        jmp verb_drop         ; AC06  4C 41 AE
jt_object_class:    ; <- 4297 4306 443D 836E 8CD2 904D 965C B463 B69A
        jmp object_class_of   ; AC09* 4C 90 A7
jt_subtract_weight:    ; <- 4206 4309 44CF 8F41 921C 965F AABC AAD4 B5EA
        jmp subtract_weight   ; AC0C  4C C9 AF
jt_print_item_name:    ; <- 42AF 4450 8379 9065 B48A B6A5
        jmp print_item_name   ; AC0F  4C D4 AF
jt_verb_done:    ; <- 3C66 3CAB 3D35 3D80 3DBA 3E1A 4094 40BC 40E5 411C 4191 41C9 41FC 4231 42F5 4326 4360 43AB 43BF 43E8 446C 4499 44E5 8359 83A7 83CB 850D 8551 85B5 86D0 90BA 90E5 9118 9139 9170 9191 9200 921F 928F 92AF 92F8 9480 94E7 96E6 A63B A676 B332 B5ED B682 B6A8
        jmp verb_done         ; AC12  4C B2 A7
verb_rest:    ; <- AC00
        jsr jt_clear_text_rows; AC15  20 06 95
        lda indoor_flag       ; AC18  AD 0E 0A
        bne LAC20             ; AC1B  D0 03
        jmp LAD35             ; AC1D  4C 35 AD
LAC20:    ; <- AC1B
        lda tile_up1          ; AC20  AD 26 0A
        cmp #$3C              ; AC23  C9 3C
        beq LAC2A             ; AC25  F0 03
        jmp LAD35             ; AC27  4C 35 AD
LAC2A:    ; <- AC25
        lda room_lo           ; AC2A  A5 86
        cmp #$09              ; AC2C  C9 09
        bne LAC3A             ; AC2E  D0 0A
        lda room_hi           ; AC30  A5 87
        bne LAC3A             ; AC32  D0 06
        lda #$01              ; AC34  A9 01
        sta dream_state       ; AC36  85 C8
        bne LAC71             ; AC38  D0 37
LAC3A:    ; <- AC2E AC32
        lda room_lo           ; AC3A  A5 86
        cmp nid_room_lo       ; AC3C  CD 6D 0A
        bne LAC45             ; AC3F  D0 04
        lda room_hi           ; AC41  A5 87
        beq LAC71             ; AC43  F0 2C
LAC45:    ; <- AC3F
        lda take_permission   ; AC45  A5 CC
        beq LAC50             ; AC47  F0 07
        lda blk_gift_class    ; AC49  AD EF 09
        cmp #$10              ; AC4C  C9 10
        beq LAC71             ; AC4E  F0 21
LAC50:    ; <- AC47
        jsr print_inline      ; AC50  20 09 80
        .byte $49,$C3,$4E,$4F,$20,$4F,$4E,$45,$20,$4F,$46,$46,$45,$52,$45,$44; AC53  I.NO ONE OFFERED
        .byte $20,$59,$4F,$55,$20,$41,$20,$4E,$49,$44,$FF; AC63   YOU A NID.
        jmp verb_done         ; AC6E  4C B2 A7
LAC71:    ; <- AC38 AC43 AC4E AC7F
        inc player_col        ; AC71  EE 10 0A
        inc last_col          ; AC74  EE 0B 0A
        jsr jt_sample_neighbors; AC77  20 00 9C
        lda tile_up1          ; AC7A  AD 26 0A
        cmp #$3D              ; AC7D  C9 3D
        bne LAC71             ; AC7F  D0 F0
        dec player_col        ; AC81  CE 10 0A
        dec last_col          ; AC84  CE 0B 0A
        ldx #$F2              ; AC87  A2 F2
        stx DC3F8             ; AC89  8E F8 C3
        inx                   ; AC8C  E8
        stx DC3F9             ; AC8D  8E F9 C3
        jsr jt_move_sprite    ; AC90  20 03 9C
        jmp LACE7             ; AC93  4C E7 AC
LAC96:    ; <- AD10
        jsr jt_advance_time   ; AC96  20 09 B1
        lda #$04              ; AC99  A9 04
        clc                   ; AC9B  18
        adc rest              ; AC9C  6D 65 0A
        sta rest              ; AC9F  8D 65 0A
        cmp rest_max1         ; ACA2  CD 6B 0A
        bcc LACAE             ; ACA5  90 07
        ldx rest_max1         ; ACA7  AE 6B 0A
        dex                   ; ACAA  CA
        stx rest              ; ACAB  8E 65 0A
LACAE:    ; <- ACA5
        ldx blk_npc_id        ; ACAE  AE F0 09
        lda npc_banished,x    ; ACB1  BD 00 23
        bne LACE7             ; ACB4  D0 31
        lda blk_npc_kind      ; ACB6  AD F1 09
        cmp #$20              ; ACB9  C9 20
        bne LACC3             ; ACBB  D0 06
        jsr LA809             ; ACBD  20 09 A8
        jmp LACE7             ; ACC0  4C E7 AC
LACC3:    ; <- ACBB
        cmp #$22              ; ACC3  C9 22
        bne LACCD             ; ACC5  D0 06
        jsr LA80C             ; ACC7  20 0C A8
        jmp LACE7             ; ACCA  4C E7 AC
LACCD:    ; <- ACC5
        cmp #$21              ; ACCD  C9 21
        bne LACDA             ; ACCF  D0 09
        jsr jt_clear_text_rows; ACD1  20 06 95
        jsr LA80F             ; ACD4  20 0F A8
        jmp verb_done         ; ACD7  4C B2 A7
LACDA:    ; <- ACCF
        cmp #$23              ; ACDA  C9 23
        bne LACE7             ; ACDC  D0 09
        jsr jt_clear_text_rows; ACDE  20 06 95
        jsr LA812             ; ACE1  20 12 A8
        jmp verb_done         ; ACE4  4C B2 A7
LACE7:    ; <- AC93 ACB4 ACC0 ACCA ACDC
        jsr jt_status_draw    ; ACE7  20 0C B1
        jsr jt_wait_input     ; ACEA  20 27 80
        jsr rest_delay_or_wake; ACED  20 13 AD
        jsr rest_delay_or_wake; ACF0  20 13 AD
        lda #$03              ; ACF3  A9 03
        sta $9E               ; ACF5  85 9E
; spirit bell: sfx 13/0 three times, then sfx 1
rest_bell_ring:    ; <- AD09
        ldx #$0D              ; ACF7  A2 0D
        jsr jt_sfx            ; ACF9  20 06 A8
        jsr rest_delay_or_wake; ACFC  20 13 AD
        ldx #$00              ; ACFF  A2 00
        jsr jt_sfx            ; AD01  20 06 A8
        jsr rest_delay_or_wake; AD04  20 13 AD
        dec $9E               ; AD07  C6 9E
        bne rest_bell_ring    ; AD09  D0 EC
        ldx #$01              ; AD0B  A2 01
        jsr jt_sfx            ; AD0D  20 06 A8
        jmp LAC96             ; AD10  4C 96 AC
rest_delay_or_wake:    ; <- ACED ACF0 ACFC AD04
        lda #$15              ; AD13  A9 15
        sta $84               ; AD15  85 84
LAD17:    ; <- AD22 AD26
        jsr jt_get_input      ; AD17  20 0F 80
        bne LAD29             ; AD1A  D0 0D
        lda in_ndirs          ; AD1C  A5 9A
        bne LAD29             ; AD1E  D0 09
        dec $85               ; AD20  C6 85
        bne LAD17             ; AD22  D0 F3
        dec $84               ; AD24  C6 84
        bne LAD17             ; AD26  D0 EF
        rts                   ; AD28  60
LAD29:    ; <- AD1A AD1E
        pla                   ; AD29  68
        pla                   ; AD2A  68
        jsr jt_clear_text_rows; AD2B  20 06 95
        jsr jt_draw_player    ; AD2E  20 0F 9C
        jsr jt_wait_input     ; AD31  20 27 80
        rts                   ; AD34  60
LAD35:    ; <- AC1D AC27
        jsr print_inline      ; AD35  20 09 80
        .byte $49,$C3,$54,$48,$45,$52,$45,$20,$49,$53,$20,$4E,$4F,$20,$4E,$49; AD38  I.THERE IS NO NI
        .byte $44,$20,$48,$45,$52,$45,$FF             ; AD48  D HERE.
        jmp verb_done         ; AD4F  4C B2 A7
verb_take:    ; <- AC03
        jsr jt_clear_text_rows; AD52  20 06 95
        jsr jt_find_object_under; AD55  20 09 B4
        bcc LAD5D             ; AD58  90 03
        jmp LADF7             ; AD5A  4C F7 AD
LAD5D:    ; <- AD58
        jsr object_class_of   ; AD5D  20 90 A7
        cpy #$0D              ; AD60  C0 0D
        bne LAD68             ; AD62  D0 04
        lda falla_key_revealed; AD64  A5 CE
        bne LADB8             ; AD66  D0 50
LAD68:    ; <- AD62
        lda indoor_flag       ; AD68  AD 0E 0A
        beq LADB8             ; AD6B  F0 4B
        lda demo_flag         ; AD6D  AD 92 0A
        bne LADB8             ; AD70  D0 46
        lda room_hi           ; AD72  A5 87
        bne LAD8D             ; AD74  D0 17
        lda room_lo           ; AD76  A5 86
        cmp nid_room_lo       ; AD78  CD 6D 0A
        beq LADB8             ; AD7B  F0 3B
        cmp #$1C              ; AD7D  C9 1C
        beq LADB8             ; AD7F  F0 37
        cmp #$3B              ; AD81  C9 3B
        beq LADB8             ; AD83  F0 33
        cmp #$4B              ; AD85  C9 4B
        beq LADB8             ; AD87  F0 2F
        cmp #$51              ; AD89  C9 51
        beq LADB8             ; AD8B  F0 2B
LAD8D:    ; <- AD74
        lda take_permission   ; AD8D  A5 CC
        beq LAD96             ; AD8F  F0 05
        cpy blk_gift_class    ; AD91  CC EF 09
        beq LADB8             ; AD94  F0 22
LAD96:    ; <- AD8F
        jsr print_inline      ; AD96  20 09 80
        .byte $49,$C3,$49,$54,$20,$57,$41,$53,$20,$4E,$4F,$54,$20,$4F,$46,$46; AD99  I.IT WAS NOT OFF
        .byte $45,$52,$45,$44,$20,$54,$4F,$20,$59,$4F,$55,$FF; ADA9  ERED TO YOU.
        jmp verb_done         ; ADB5  4C B2 A7
LADB8:    ; <- AD66 AD6B AD70 AD7B AD7F AD83 AD87 AD8B AD94
        lda item_weight,y     ; ADB8  B9 32 AE
        clc                   ; ADBB  18
        adc carried_weight    ; ADBC  6D 7A 0A
        cmp carry_limit       ; ADBF  CD 6C 0A
        bcs LAE14             ; ADC2  B0 50
        sta carried_weight    ; ADC4  8D 7A 0A
        lda obj_flags,x       ; ADC7  BD 00 0F
        ora #$20              ; ADCA  09 20
        sta obj_flags,x       ; ADCC  9D 00 0F
        tya                   ; ADCF  98
        pha                   ; ADD0  48
        jsr print_inline      ; ADD1  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$46,$49,$4E,$44,$20,$FF; ADD4  I.YOU FIND .
        pla                   ; ADE0  68
        tay                   ; ADE1  A8
        lda #$52              ; ADE2  A9 52
        sta $80               ; ADE4  85 80
        lda #$C3              ; ADE6  A9 C3
        sta $81               ; ADE8  85 81
        jsr print_item_name   ; ADEA  20 D4 AF
        jsr L8C03             ; ADED  20 03 8C
        lda #$00              ; ADF0  A9 00
        sta take_permission   ; ADF2  85 CC
        jmp verb_done         ; ADF4  4C B2 A7
LADF7:    ; <- AD5A
        jsr print_inline      ; ADF7  20 09 80
        .byte $49,$C3,$4E,$4F,$54,$48,$49,$4E,$47,$20,$48,$45,$52,$45,$20,$54; ADFA  I.NOTHING HERE T
        .byte $4F,$20,$54,$41,$4B,$45,$FF             ; AE0A  O TAKE.
        jmp verb_done         ; AE11  4C B2 A7
LAE14:    ; <- ADC2
        jsr print_inline      ; AE14  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$43,$41,$4E,$20,$43,$41,$52,$52,$59,$20; AE17  I.YOU CAN CARRY 
        .byte $4E,$4F,$20,$4D,$4F,$52,$45,$FF         ; AE27  NO MORE.
        jmp verb_done         ; AE2F  4C B2 A7
; every class weighs 5 except tokens, which weigh 1
item_weight:    ; <- ADB8 AFCD
        .byte $05,$05,$05,$05,$05,$05,$05,$05,$01,$05,$05,$05,$05,$05,$05; AE32  ...............
verb_drop:    ; <- AC06
        jsr jt_clear_text_rows; AE41  20 06 95
        lda indoor_flag       ; AE44  AD 0E 0A
        beq LAE97             ; AE47  F0 4E
        lda nid_room_lo       ; AE49  AD 6D 0A
        cmp room_lo           ; AE4C  C5 86
        bne LAE57             ; AE4E  D0 07
        lda nid_room_hi       ; AE50  AD 6E 0A
        cmp room_hi           ; AE53  C5 87
        beq LAE5A             ; AE55  F0 03
LAE57:    ; <- AE4E
        jmp LAFB5             ; AE57  4C B5 AF
LAE5A:    ; <- AE55
        lda tile_up1          ; AE5A  AD 26 0A
        cmp #$57              ; AE5D  C9 57
        bcc LAE97             ; AE5F  90 36
        cmp #$59              ; AE61  C9 59
        bcs LAE97             ; AE63  B0 32
        lda tile_up2          ; AE65  AD 27 0A
        cmp #$E1              ; AE68  C9 E1
        bcs LAE97             ; AE6A  B0 2B
        lda facing            ; AE6C  AD 37 0A
        bmi LAE7E             ; AE6F  30 0D
        lda tile_up2right     ; AE71  AD 2A 0A
        cmp #$E1              ; AE74  C9 E1
        bcs LAE97             ; AE76  B0 1F
        ldx player_col        ; AE78  AE 10 0A
        jmp LAE89             ; AE7B  4C 89 AE
LAE7E:    ; <- AE6F
        lda tile_up2left      ; AE7E  AD 29 0A
        cmp #$E1              ; AE81  C9 E1
        bcs LAE97             ; AE83  B0 12
        ldx player_col        ; AE85  AE 10 0A
        dex                   ; AE88  CA
LAE89:    ; <- AE7B
        stx verb_tmp0         ; AE89  8E 56 0A
        ldx player_row        ; AE8C  AE 18 0A
        dex                   ; AE8F  CA
        dex                   ; AE90  CA
        stx verb_tmp1         ; AE91  8E 57 0A
        jmp LAEEA             ; AE94  4C EA AE
LAE97:    ; <- AE47 AE5F AE63 AE6A AE76 AE83
        lda tile_below        ; AE97  AD 23 0A
        cmp #$DF              ; AE9A  C9 DF
        bcs LAEE7             ; AE9C  B0 49
        jsr jt_tile_props     ; AE9E  20 09 9C
        lda tp_solid          ; AEA1  AD 2D 0A
        beq LAEE7             ; AEA4  F0 41
        lda tile_at           ; AEA6  AD 20 0A
        cmp #$E1              ; AEA9  C9 E1
        bcs LAEE7             ; AEAB  B0 3A
        lda facing            ; AEAD  AD 37 0A
        bmi LAEBB             ; AEB0  30 09
        lda tile_right        ; AEB2  AD 22 0A
        ldx player_col        ; AEB5  AE 10 0A
        jmp LAEC2             ; AEB8  4C C2 AE
LAEBB:    ; <- AEB0
        lda tile_left         ; AEBB  AD 21 0A
        ldx player_col        ; AEBE  AE 10 0A
        dex                   ; AEC1  CA
LAEC2:    ; <- AEB8
        stx verb_tmp0         ; AEC2  8E 56 0A
        ldx player_row        ; AEC5  AE 18 0A
        stx verb_tmp1         ; AEC8  8E 57 0A
        cmp #$E1              ; AECB  C9 E1
        bcs LAEE7             ; AECD  B0 18
        cmp #$07              ; AECF  C9 07
        beq LAEE7             ; AED1  F0 14
        cmp #$08              ; AED3  C9 08
        beq LAEE7             ; AED5  F0 10
        cmp #$52              ; AED7  C9 52
        beq LAEE7             ; AED9  F0 0C
        cmp #$1C              ; AEDB  C9 1C
        beq LAEE7             ; AEDD  F0 08
        jsr jt_tile_props     ; AEDF  20 09 9C
        lda tp_solid          ; AEE2  AD 2D 0A
        beq LAEEA             ; AEE5  F0 03
LAEE7:    ; <- AE9C AEA4 AEAB AECD AED1 AED5 AED9 AEDD
        jmp LAFB5             ; AEE7  4C B5 AF
LAEEA:    ; <- AE94 AEE5
        jsr print_inline      ; AEEA  20 09 80
        .byte $49,$C3,$57,$48,$41,$54,$20,$57,$49,$4C,$4C,$20,$59,$4F,$55,$20; AEED  I.WHAT WILL YOU 
        .byte $44,$52,$4F,$50,$3F,$FF                 ; AEFD  DROP?.
        lda #$FF              ; AF03  A9 FF
        sta pick_index        ; AF05  8D 54 0A
        sta cycle_first       ; AF08  85 D2
        jsr jt_wait_input     ; AF0A  20 27 80
LAF0D:    ; <- AF36 AF53
        inc pick_index        ; AF0D  EE 54 0A
        ldx pick_index        ; AF10  AE 54 0A
        cpx #$FF              ; AF13  E0 FF
        bne LAF30             ; AF15  D0 19
        jsr print_inline      ; AF17  20 09 80
        .byte $5E,$C3,$4E,$4F,$54,$48,$49,$4E,$47,$20,$20,$20,$20,$20,$20,$20; AF1A  ^.NOTHING       
        .byte $20,$20,$FF                             ; AF2A    .
        jmp LAF47             ; AF2D  4C 47 AF
LAF30:    ; <- AF15
        lda obj_flags,x       ; AF30  BD 00 0F
        bit obj_bit_carried   ; AF33  2C A5 0A
        beq LAF0D             ; AF36  F0 D5
        txa                   ; AF38  8A
        jsr object_class_of   ; AF39  20 90 A7
        lda #$5E              ; AF3C  A9 5E
        sta $80               ; AF3E  85 80
        lda #$C3              ; AF40  A9 C3
        sta $81               ; AF42  85 81
        jsr print_item_name   ; AF44  20 D4 AF
LAF47:    ; <- AF2D
        jsr LA818             ; AF47  20 18 A8
LAF4A:    ; <- AF51
        jsr jt_get_input      ; AF4A  20 0F 80
        bne LAF56             ; AF4D  D0 07
        lda in_dy             ; AF4F  A5 99
        bpl LAF4A             ; AF51  10 F7
        jmp LAF0D             ; AF53  4C 0D AF
LAF56:    ; <- AF4D
        jsr jt_clear_text_rows; AF56  20 06 95
        ldx pick_index        ; AF59  AE 54 0A
        cpx #$FF              ; AF5C  E0 FF
        beq LAFB4             ; AF5E  F0 54
        lda room_lo           ; AF60  A5 86
        sta obj_room_lo,x     ; AF62  9D 00 0D
        lda verb_tmp0         ; AF65  AD 56 0A
        sta obj_col,x         ; AF68  9D 00 0E
        lda verb_tmp1         ; AF6B  AD 57 0A
        ldy room_hi           ; AF6E  A4 87
        beq LAF74             ; AF70  F0 02
        ora #$80              ; AF72  09 80
LAF74:    ; <- AF70
        ora #$40              ; AF74  09 40
        sta obj_flags,x       ; AF76  9D 00 0F
        lda lamp_index        ; AF79  A5 CA
        beq LAFA8             ; AF7B  F0 2B
        cpx lamp_index        ; AF7D  E4 CA
        bne LAFA8             ; AF7F  D0 27
        lda #$00              ; AF81  A9 00
        sta obj_flags,x       ; AF83  9D 00 0F
        sta lamp_index        ; AF86  85 CA
        sta lamp_fuel         ; AF88  85 CB
        jsr LAFA8             ; AF8A  20 A8 AF
        jsr print_inline      ; AF8D  20 09 80
        .byte $49,$C3,$59,$4F,$55,$52,$20,$4C,$41,$4D,$50,$20,$56,$41,$4E,$49; AF90  I.YOUR LAMP VANI
        .byte $53,$48,$45,$53,$FF                     ; AFA0  SHES.
        jmp verb_done         ; AFA5  4C B2 A7
LAFA8:    ; <- AF7B AF7F AF8A
        jsr L8C03             ; AFA8  20 03 8C
        lda pick_index        ; AFAB  AD 54 0A
        jsr object_class_of   ; AFAE  20 90 A7
        jsr subtract_weight   ; AFB1  20 C9 AF
LAFB4:    ; <- AF5E
        rts                   ; AFB4  60
LAFB5:    ; <- AE57 AEE7
        jsr jt_clear_text_rows; AFB5  20 06 95
        jsr print_inline      ; AFB8  20 09 80
        .byte $49,$C3,$4E,$4F,$54,$20,$48,$45,$52,$45,$FF; AFBB  I.NOT HERE.
        jmp verb_done         ; AFC6  4C B2 A7
; Y = class; $0A7A -= item_weight[Y]
subtract_weight:    ; <- AC0C AFB1
        lda carried_weight    ; AFC9  AD 7A 0A
        sec                   ; AFCC  38
        sbc item_weight,y     ; AFCD  F9 32 AE
        sta carried_weight    ; AFD0  8D 7A 0A
        rts                   ; AFD3  60
; Y = class; 16 chars from $AFF7 to ($80); $A8 set forces reverse video
print_item_name:    ; <- AC0F ADEA AF44
        ldx item_name_ofs,y   ; AFD4  BE 80 A7
        lda #$10              ; AFD7  A9 10
        sta $84               ; AFD9  85 84
        ldy #$00              ; AFDB  A0 00
LAFDD:    ; <- AFF0
        lda item_names,x      ; AFDD  BD F7 AF
        pha                   ; AFE0  48
        lda reverse_video     ; AFE1  A5 A8
        beq LAFE9             ; AFE3  F0 04
        pla                   ; AFE5  68
        ora #$80              ; AFE6  09 80
        pha                   ; AFE8  48
LAFE9:    ; <- AFE3
        pla                   ; AFE9  68
        sta ($80),y           ; AFEA  91 80
        inx                   ; AFEC  E8
        iny                   ; AFED  C8
        dec $84               ; AFEE  C6 84
        bne LAFDD             ; AFF0  D0 EB
        lda #$00              ; AFF2  A9 00
        sta reverse_video     ; AFF4  85 A8
        rts                   ; AFF6  60
item_names:    ; <- AFDD
        .byte $41,$20,$53,$50,$49,$52,$49,$54,$20,$42,$45,$4C,$4C,$20,$20,$20; AFF7  A SPIRIT BELL   
        .byte $41,$20,$53,$50,$49,$52,$49,$54,$20,$4C,$41,$4D,$50,$20,$20,$20; B007  A SPIRIT LAMP   
        .byte $41,$20,$48,$4F,$4E,$45,$59,$4C,$41,$4D,$50,$20,$20,$20,$20,$20; B017  A HONEYLAMP     
        .byte $41,$20,$57,$41,$4E,$44,$20,$4F,$46,$20,$42,$45,$46,$41,$4C,$20; B027  A WAND OF BEFAL 
        .byte $41,$20,$52,$4F,$41,$53,$54,$20,$4C,$41,$50,$41,$4E,$20,$20,$20; B037  A ROAST LAPAN   
        .byte $50,$41,$4E,$20,$42,$52,$45,$41,$44,$20,$20,$20,$20,$20,$20,$20; B047  PAN BREAD       
        .byte $46,$52,$55,$49,$54,$20,$26,$20,$4E,$55,$54,$53,$20,$20,$20,$20; B057  FRUIT & NUTS    
        .byte $41,$20,$53,$48,$55,$42,$41,$20,$20,$20,$20,$20,$20,$20,$20,$20; B067  A SHUBA         
        .byte $41,$20,$54,$4F,$4B,$45,$4E,$20,$20,$20,$20,$20,$20,$20,$20,$20; B077  A TOKEN         
        .byte $41,$20,$54,$52,$45,$4E,$43,$48,$45,$52,$20,$42,$45,$41,$4B,$20; B087  A TRENCHER BEAK 
        .byte $57,$49,$53,$53,$45,$4E,$42,$45,$52,$52,$49,$45,$53,$20,$20,$20; B097  WISSENBERRIES   
        .byte $41,$20,$56,$49,$4E,$45,$20,$52,$4F,$50,$45,$20,$20,$20,$20,$20; B0A7  A VINE ROPE     
        .byte $54,$48,$45,$20,$54,$45,$4D,$50,$4C,$45,$20,$4B,$45,$59,$20,$20; B0B7  THE TEMPLE KEY  
        .byte $44,$27,$4F,$4C,$20,$46,$41,$4C,$4C,$41,$27,$53,$20,$4B,$45,$59; B0C7  D'OL FALLA'S KEY
        .byte $41,$20,$53,$54,$52,$41,$4E,$47,$45,$20,$45,$4C,$49,$58,$45,$52; B0D7  A STRANGE ELIXER
        .byte $90,$A0,$B0,$C0,$D0,$E0,$F0,$C0,$D0,$E0,$F0,$00,$00,$00,$00,$00; B0E7  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00     ; B0F7  .........
jt_verb_status:    ; <- A913
        jmp verb_status       ; B100* 4C 0F B1
        .byte $4C,$22,$B1                             ; B103  L".
jt_clock_tick:    ; <- A01B
        jmp clock_tick        ; B106* 4C 6F B2
jt_advance_time:    ; <- AC96 B567 B56A
        jmp advance_time      ; B109  4C 87 B2
jt_status_draw:    ; <- ACE7
        jmp status_draw       ; B10C  4C 25 B1
verb_status:    ; <- B100
        jsr draw_status       ; B10F* 20 22 B1
        jsr jt_wait_input     ; B112* 20 27 80
LB115:    ; <- B11C
        jsr jt_get_input      ; B115* 20 0F 80
        bne LB11E             ; B118* D0 04
        lda in_ndirs          ; B11A* A5 9A
        beq LB115             ; B11C* F0 F7
LB11E:    ; <- B118
        jsr jt_clear_text_rows; B11E  20 06 95
        rts                   ; B121  60
draw_status:    ; <- B10F
        jsr jt_clear_text_rows; B122* 20 06 95
status_draw:    ; <- B10C
        jsr print_inline      ; B125* 20 09 80
        .byte $49,$C3,$44,$41,$59,$FF                 ; B128  I.DAY.
        ldx loaded_player     ; B12E* AE 60 0A
        ldy char_name_ends,x  ; B131* BC CB B1
        ldx #$04              ; B134* A2 04
LB136:    ; <- B13E
        lda char_names,y      ; B136* B9 D0 B1
        sta DC35C,x           ; B139* 9D 5C C3
        dey                   ; B13C* 88
        dex                   ; B13D* CA
        bpl LB136             ; B13E* 10 F6
        ldx time_of_day       ; B140* AE 61 0A
        ldy time_of_day_ends,x; B143* BC 67 B2
        ldx #$0E              ; B146* A2 0E
LB148:    ; <- B150
        lda time_of_day_names,y; B148* B9 E9 B1
        sta DC371,x           ; B14B* 9D 71 C3
        dey                   ; B14E* 88
        dex                   ; B14F* CA
        bpl LB148             ; B150* 10 F6
        jsr print_inline      ; B152* 20 09 80
        .byte $84,$C3,$4C,$45,$56,$45,$4C,$20,$4F,$46,$20,$52,$45,$53,$54,$FF; B155  ..LEVEL OF REST.
        jsr print_inline      ; B165* 20 09 80
        .byte $99,$C3,$53,$50,$49,$52,$49,$54,$20,$4C,$49,$4D,$49,$54,$FF; B168  ..SPIRIT LIMIT.
        jsr print_inline      ; B177* 20 09 80
        .byte $AC,$C3,$4C,$45,$56,$45,$4C,$20,$4F,$46,$20,$46,$4F,$4F,$44,$FF; B17A  ..LEVEL OF FOOD.
        jsr print_inline      ; B18A* 20 09 80
        .byte $C1,$C3,$53,$54,$41,$4D,$49,$4E,$41,$FF ; B18D  ..STAMINA.
        jsr print_inline      ; B197* 20 09 80
        .byte $D4,$C3,$4C,$45,$56,$45,$4C,$20,$4F,$46,$20,$53,$50,$49,$52,$49; B19A  ..LEVEL OF SPIRI
        .byte $54,$FF                                 ; B1AA  T.
        ldy #$05              ; B1AC* A0 05
LB1AE:    ; <- B1C8
        ldx day,y             ; B1AE* BE 62 0A
        tya                   ; B1B1* 98
        pha                   ; B1B2* 48
        ldy #$00              ; B1B3* A0 00
        jsr jt_to_decimal     ; B1B5* 20 0C 80
        pla                   ; B1B8* 68
        tay                   ; B1B9* A8
        ldx status_num_ofs,y  ; B1BA* BE 61 B2
        lda $95               ; B1BD* A5 95
        sta DC348,x           ; B1BF* 9D 48 C3
        lda $96               ; B1C2* A5 96
        sta DC349,x           ; B1C4* 9D 49 C3
        dey                   ; B1C7* 88
        bpl LB1AE             ; B1C8* 10 E4
        rts                   ; B1CA* 60
char_name_ends:    ; <- B131
        .byte $04,$09,$0E,$13,$18                     ; B1CB  .....
char_names:    ; <- B136
        .byte $4E,$45,$52,$49,$43,$47,$45,$4E,$41,$41,$48,$45,$52,$44,$20,$50; B1D0  NERICGENAAHERD P
        .byte $4F,$4D,$4D,$41,$43,$48,$41,$52,$4E     ; B1E0  OMMACHARN
; eight 15-char time-of-day names
time_of_day_names:    ; <- B148
        .byte $45,$41,$52,$4C,$59,$20,$4D,$4F,$52,$4E,$49,$4E,$47,$20,$20,$4C; B1E9  EARLY MORNING  L
        .byte $41,$54,$45,$20,$4D,$4F,$52,$4E,$49,$4E,$47,$20,$20,$20,$45,$41; B1F9  ATE MORNING   EA
        .byte $52,$4C,$59,$20,$41,$46,$54,$45,$52,$4E,$4F,$4F,$4E,$4C,$41,$54; B209  RLY AFTERNOONLAT
        .byte $45,$20,$41,$46,$54,$45,$52,$4E,$4F,$4F,$4E,$20,$45,$41,$52,$4C; B219  E AFTERNOON EARL
        .byte $59,$20,$45,$56,$45,$4E,$49,$4E,$47,$20,$20,$4C,$41,$54,$45,$20; B229  Y EVENING  LATE 
        .byte $45,$56,$45,$4E,$49,$4E,$47,$20,$20,$20,$4D,$49,$44,$4E,$49,$47; B239  EVENING   MIDNIG
        .byte $48,$54,$20,$20,$20,$20,$20,$20,$20,$4C,$41,$54,$45,$20,$4E,$49; B249  HT       LATE NI
        .byte $47,$48,$54,$20,$20,$20,$20,$20         ; B259  GHT     
; screen offset from $C348 for $0A62+y, y = 0..5
status_num_ofs:    ; <- B1BA
        .byte $05,$9C,$74,$4C,$81,$5E                 ; B261  ..tL.^
time_of_day_ends:    ; <- B143
        .byte $0E,$1D,$2C,$3B,$4A,$59,$68,$77         ; B267  ..,;JYhw
; per-frame clock; frozen while $C8 is set
clock_tick:    ; <- B106
        lda dream_state       ; B26F* A5 C8
        bne LB278             ; B271* D0 05
        dec clock_prescale    ; B273* CE 78 0A
        beq LB279             ; B276* F0 01
LB278:    ; <- B271 B27C
        rts                   ; B278* 60
LB279:    ; <- B276
        dec clock_period      ; B279* CE 79 0A
        bne LB278             ; B27C* D0 FA
        lda #$23              ; B27E* A9 23
        sta clock_period      ; B280* 8D 79 0A
        jsr advance_time      ; B283* 20 87 B2
        rts                   ; B286* 60
; one time slot: $0A61, day wrap, food/rest down, +5 spirit energy
advance_time:    ; <- B109 B283
        inc time_of_day       ; B287* EE 61 0A
        lda time_of_day       ; B28A* AD 61 0A
        cmp #$08              ; B28D* C9 08
        bne LB299             ; B28F* D0 08
        lda #$00              ; B291  A9 00
        sta time_of_day       ; B293  8D 61 0A
        inc day               ; B296  EE 62 0A
LB299:    ; <- B28F
        lda day               ; B299* AD 62 0A
; day $33 = 51 ends the quest
        cmp #$33              ; B29C* C9 33
        bcc LB2AA             ; B29E* 90 0A
        lda #$00              ; B2A0  A9 00
        sta game_active       ; B2A2  8D 04 0A
        lda #$01              ; B2A5  A9 01
        sta quest_time_up     ; B2A7  85 DE
        rts                   ; B2A9  60
; one food and one rest per period, $C4 set on underflow
LB2AA:    ; <- B29E
        dec food              ; B2AA* CE 64 0A
        bpl LB2C2             ; B2AD* 10 13
        lda #$00              ; B2AF  A9 00
        sta food              ; B2B1  8D 64 0A
        lda game_active       ; B2B4  AD 04 0A
        beq LB2C2             ; B2B7  F0 09
        lda #$01              ; B2B9  A9 01
        sta fatigue_cause     ; B2BB  85 C4
        lda #$00              ; B2BD  A9 00
        sta game_active       ; B2BF  8D 04 0A
LB2C2:    ; <- B2AD B2B7
        dec rest              ; B2C2* CE 65 0A
        bpl LB2DA             ; B2C5* 10 13
        lda #$00              ; B2C7  A9 00
        sta rest              ; B2C9  8D 65 0A
        lda game_active       ; B2CC  AD 04 0A
        beq LB2DA             ; B2CF  F0 09
        lda #$02              ; B2D1  A9 02
        sta fatigue_cause     ; B2D3  85 C4
        lda #$00              ; B2D5  A9 00
        sta game_active       ; B2D7  8D 04 0A
; spirit +5 per period, capped at the limit $0A67
LB2DA:    ; <- B2C5 B2CF
        lda spirit_energy     ; B2DA* AD 63 0A
        clc                   ; B2DD* 18
        adc #$05              ; B2DE* 69 05
        cmp spirit_limit      ; B2E0* CD 67 0A
        bcc LB2E8             ; B2E3* 90 03
        lda spirit_limit      ; B2E5* AD 67 0A
LB2E8:    ; <- B2E3
        sta spirit_energy     ; B2E8* 8D 63 0A
        lda #$23              ; B2EB* A9 23
        sta clock_period      ; B2ED* 8D 79 0A
        rts                   ; B2F0* 60
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B2F1  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B301  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B311  ...............
creature_hit_effect:    ; <- A815
        lda #$04              ; B320  A9 04
        sta D0A4B             ; B322  8D 4B 0A
        lda creature_hit      ; B325  A5 D1
        cmp #$E0              ; B327  C9 E0
        bne LB335             ; B329  D0 0A
        jsr rest_wake_room_1c ; B32B  20 DB AA
LB32E:    ; <- B388 B392 B3DE
        lda #$00              ; B32E  A9 00
        sta creature_hit      ; B330  85 D1
        jmp jt_verb_done      ; B332  4C 12 AC
LB335:    ; <- B329
        cmp #$E1              ; B335  C9 E1
        bne LB38B             ; B337  D0 52
        jsr jt_return_home    ; B339  20 03 A6
        jsr print_inline      ; B33C  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$57,$45,$52,$45,$20,$41,$54,$54,$41,$43; B33F  I.YOU WERE ATTAC
        .byte $4B,$45,$44,$20,$42,$59,$20,$41,$20,$46,$4F,$4C,$4C,$4F,$57,$45; B34F  KED BY A FOLLOWE
        .byte $52,$20,$4F,$46,$20,$20,$20,$20,$20,$20,$44,$27,$4F,$4C,$20,$53; B35F  R OF      D'OL S
        .byte $41,$4C,$41,$41,$54,$2E,$20,$20,$54,$49,$4D,$45,$20,$48,$41,$53; B36F  ALAAT.  TIME HAS
        .byte $20,$50,$41,$53,$53,$45,$44,$2E,$FF     ; B37F   PASSED..
        jmp LB32E             ; B388  4C 2E B3
LB38B:    ; <- B337
        cmp #$E2              ; B38B  C9 E2
        bne LB395             ; B38D  D0 06
        jsr rest_wake_room_3b ; B38F  20 45 AB
        jmp LB32E             ; B392  4C 2E B3
LB395:    ; <- B38D
        jsr jt_return_home    ; B395  20 03 A6
        jsr print_inline      ; B398  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$57,$45,$52,$45,$20,$41,$54,$54,$41,$43; B39B  I.YOU WERE ATTAC
        .byte $4B,$45,$44,$20,$42,$59,$20,$41,$20,$4D,$45,$4D,$42,$45,$52,$20; B3AB  KED BY A MEMBER 
        .byte $4F,$46,$20,$54,$48,$45,$20,$20,$20,$20,$4E,$45,$4B,$4F,$4D,$2E; B3BB  OF THE    NEKOM.
        .byte $20,$20,$54,$49,$4D,$45,$20,$48,$41,$53,$20,$50,$41,$53,$53,$45; B3CB    TIME HAS PASSE
        .byte $44,$2E,$FF                             ; B3DB  D..
        jmp LB32E             ; B3DE  4C 2E B3
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B3E1  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B3F1  ...............
jt_verb_eat:    ; <- A8D1
        jmp verb_eat          ; B400  4C 0C B4
jt_verb_examine:    ; <- A8FA
        jmp verb_examine      ; B403  4C 53 B6
jt_find_object_at:    ; <- 86E5
        jmp find_object_at    ; B406  4C 1D B6
jt_find_object_under:    ; <- AD55
        jmp find_object_under_player; B409  4C F0 B5
verb_eat:    ; <- B400
        jsr jt_clear_text_rows; B40C  20 06 95
        jsr print_inline      ; B40F  20 09 80
        .byte $49,$C3,$57,$48,$41,$54,$20,$57,$49,$4C,$4C,$20,$59,$4F,$55,$20; B412  I.WHAT WILL YOU 
        .byte $45,$41,$54,$3F,$FF                     ; B422  EAT?.
        lda #$FF              ; B427  A9 FF
        sta pick_index        ; B429  8D 54 0A
        sta pick_class        ; B42C  8D 55 0A
        sta cycle_first       ; B42F  85 D2
        jsr jt_wait_input     ; B431  20 27 80
LB434:    ; <- B460 B469 B47D B499
        inc pick_index        ; B434  EE 54 0A
        ldx pick_index        ; B437  AE 54 0A
        cpx #$FF              ; B43A  E0 FF
        bne LB45A             ; B43C  D0 1C
        stx pick_class        ; B43E  8E 55 0A
        jsr print_inline      ; B441  20 09 80
        .byte $5D,$C3,$4E,$4F,$54,$48,$49,$4E,$47,$20,$20,$20,$20,$20,$20,$20; B444  ].NOTHING       
        .byte $20,$20,$FF                             ; B454    .
        jmp LB48D             ; B457  4C 8D B4
LB45A:    ; <- B43C
        lda obj_flags,x       ; B45A  BD 00 0F
        bit obj_bit_carried   ; B45D  2C A5 0A
        beq LB434             ; B460  F0 D2
        txa                   ; B462  8A
        jsr jt_object_class   ; B463  20 09 AC
        cpy pick_class        ; B466  CC 55 0A
        beq LB434             ; B469  F0 C9
        cpy #$04              ; B46B  C0 04
        beq LB47F             ; B46D  F0 10
        cpy #$05              ; B46F  C0 05
        beq LB47F             ; B471  F0 0C
        cpy #$06              ; B473  C0 06
        beq LB47F             ; B475  F0 08
        cpy #$0A              ; B477  C0 0A
        beq LB47F             ; B479  F0 04
        cpy #$0E              ; B47B  C0 0E
        bne LB434             ; B47D  D0 B5
LB47F:    ; <- B46D B471 B475 B479
        sty pick_class        ; B47F  8C 55 0A
        lda #$5D              ; B482  A9 5D
        sta $80               ; B484  85 80
        lda #$C3              ; B486  A9 C3
        sta $81               ; B488  85 81
        jsr jt_print_item_name; B48A  20 0F AC
LB48D:    ; <- B457
        jsr LA818             ; B48D  20 18 A8
LB490:    ; <- B497
        jsr jt_get_input      ; B490  20 0F 80
        bne LB49C             ; B493  D0 07
        lda in_dy             ; B495  A5 99
        bpl LB490             ; B497  10 F7
        jmp LB434             ; B499  4C 34 B4
LB49C:    ; <- B493
        jsr jt_clear_text_rows; B49C  20 06 95
        ldx pick_index        ; B49F  AE 54 0A
        cpx #$FF              ; B4A2  E0 FF
        bne LB4A7             ; B4A4  D0 01
        rts                   ; B4A6  60
LB4A7:    ; <- B4A4
        ldy pick_class        ; B4A7  AC 55 0A
        cpy #$04              ; B4AA  C0 04
        bne LB506             ; B4AC  D0 58
        lda loaded_player     ; B4AE  AD 60 0A
        cmp #$02              ; B4B1  C9 02
        beq LB4EC             ; B4B3  F0 37
        cmp #$04              ; B4B5  C9 04
        beq LB4EC             ; B4B7  F0 33
        jsr print_inline      ; B4B9  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$4C,$41,$50,$41,$4E,$20,$48,$41,$53,$20; B4BC  I.THE LAPAN HAS 
        .byte $41,$20,$53,$54,$52,$41,$4E,$47,$45,$20,$54,$41,$53,$54,$45,$FF; B4CC  A STRANGE TASTE.
        lda spirit_energy     ; B4DC  AD 63 0A
        sec                   ; B4DF  38
        sbc #$0F              ; B4E0  E9 0F
        bcs LB4E6             ; B4E2  B0 02
        lda #$00              ; B4E4  A9 00
LB4E6:    ; <- B4E2
        sta spirit_energy     ; B4E6  8D 63 0A
        jmp LB54B             ; B4E9  4C 4B B5
LB4EC:    ; <- B4B3 B4B7
        jsr print_inline      ; B4EC  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$4C,$41,$50,$41,$4E,$20,$49,$53,$20,$47; B4EF  I.THE LAPAN IS G
        .byte $4F,$4F,$44,$FF                         ; B4FF  OOD.
        jmp LB54B             ; B503  4C 4B B5
LB506:    ; <- B4AC
        cpy #$05              ; B506  C0 05
        bne LB528             ; B508  D0 1E
        jsr print_inline      ; B50A  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$50,$41,$4E,$20,$42,$52,$45,$41,$44,$20; B50D  I.THE PAN BREAD 
        .byte $49,$53,$20,$47,$4F,$4F,$44,$FF         ; B51D  IS GOOD.
        jmp LB54B             ; B525  4C 4B B5
LB528:    ; <- B508
        cpy #$06              ; B528  C0 06
        bne LB563             ; B52A  D0 37
        jsr print_inline      ; B52C  20 09 80
        .byte $49,$C3,$54,$48,$45,$20,$46,$52,$55,$49,$54,$20,$26,$20,$4E,$55; B52F  I.THE FRUIT & NU
        .byte $54,$53,$20,$41,$52,$45,$20,$47,$4F,$4F,$44,$FF; B53F  TS ARE GOOD.
LB54B:    ; <- B4E9 B503 B525
        lda #$05              ; B54B  A9 05
        clc                   ; B54D  18
        adc food              ; B54E  6D 64 0A
        sta food              ; B551  8D 64 0A
        cmp food_max1         ; B554  CD 6A 0A
        bcc LB560             ; B557  90 07
        ldx food_max1         ; B559  AE 6A 0A
        dex                   ; B55C  CA
        stx food              ; B55D  8E 64 0A
LB560:    ; <- B557
        jmp LB5DF             ; B560  4C DF B5
LB563:    ; <- B52A
        cpy #$0A              ; B563  C0 0A
        bne LB5A2             ; B565  D0 3B
        jsr jt_advance_time   ; B567  20 09 B1
        jsr jt_advance_time   ; B56A  20 09 B1
        jsr print_inline      ; B56D  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$46,$45,$45,$4C,$20,$53,$54,$52,$41,$4E; B570  I.YOU FEEL STRAN
        .byte $47,$45,$2E,$20,$20,$54,$49,$4D,$45,$20,$50,$41,$53,$53,$45,$53; B580  GE.  TIME PASSES
        .byte $2E,$FF                                 ; B590  ..
        lda spirit_energy     ; B592  AD 63 0A
        sec                   ; B595  38
        sbc #$0F              ; B596  E9 0F
        bcs LB59C             ; B598  B0 02
        lda #$00              ; B59A  A9 00
LB59C:    ; <- B598
        sta spirit_energy     ; B59C  8D 63 0A
        jmp LB5DF             ; B59F  4C DF B5
LB5A2:    ; <- B565
        jsr print_inline      ; B5A2  20 09 80
        .byte $49,$C3,$59,$4F,$55,$20,$46,$45,$45,$4C,$20,$4D,$55,$43,$48,$20; B5A5  I.YOU FEEL MUCH 
        .byte $53,$54,$52,$4F,$4E,$47,$45,$52,$FF     ; B5B5  STRONGER.
        lda stamina           ; B5BE  AD 66 0A
        clc                   ; B5C1  18
        adc #$05              ; B5C2  69 05
        sta stamina           ; B5C4  8D 66 0A
        lsr a                 ; B5C7  4A
        tax                   ; B5C8  AA
        stx rest              ; B5C9  8E 65 0A
        stx food              ; B5CC  8E 64 0A
        inx                   ; B5CF  E8
        stx rest_max1         ; B5D0  8E 6B 0A
        stx food_max1         ; B5D3  8E 6A 0A
        lda carry_limit       ; B5D6  AD 6C 0A
        clc                   ; B5D9  18
        adc #$05              ; B5DA  69 05
        sta carry_limit       ; B5DC  8D 6C 0A
LB5DF:    ; <- B560 B59F
        ldx pick_index        ; B5DF  AE 54 0A
        lda #$00              ; B5E2  A9 00
        sta obj_flags,x       ; B5E4  9D 00 0F
        ldy pick_class        ; B5E7  AC 55 0A
        jsr jt_subtract_weight; B5EA  20 0C AC
        jmp jt_verb_done      ; B5ED  4C 12 AC
; object under the player, for TAKE and EXAMINE; C set = none
find_object_under_player:    ; <- B409 B656
        lda tile_up2          ; B5F0  AD 27 0A
        cmp #$E0              ; B5F3  C9 E0
        bcc LB601             ; B5F5  90 0A
        ldx player_row        ; B5F7  AE 18 0A
        dex                   ; B5FA  CA
        dex                   ; B5FB  CA
        stx $85               ; B5FC  86 85
        jmp LB610             ; B5FE  4C 10 B6
LB601:    ; <- B5F5
        lda tile_at           ; B601  AD 20 0A
        cmp #$E0              ; B604  C9 E0
        bcs LB60B             ; B606  B0 03
        jmp LB651             ; B608  4C 51 B6
LB60B:    ; <- B606
        ldx player_row        ; B60B  AE 18 0A
        stx $85               ; B60E  86 85
LB610:    ; <- B5FE
        ldx player_col        ; B610  AE 10 0A
        bit joy_up            ; B613  2C A0 0A
        bne LB619             ; B616  D0 01
        dex                   ; B618  CA
LB619:    ; <- B616
        stx $84               ; B619  86 84
        sta $9E               ; B61B  85 9E
; scan all 256 objects for one at ($84,$85) in this room, on the ground
find_object_at:    ; <- B406
        ldx #$00              ; B61D  A2 00
LB61F:    ; <- B64F
        lda obj_room_lo,x     ; B61F  BD 00 0D
        cmp room_lo           ; B622  C5 86
        bne LB64E             ; B624  D0 28
        lda obj_flags,x       ; B626  BD 00 0F
        asl a                 ; B629  0A
        lda #$00              ; B62A  A9 00
        rol a                 ; B62C  2A
        cmp room_hi           ; B62D  C5 87
        bne LB64E             ; B62F  D0 1D
        lda obj_flags,x       ; B631  BD 00 0F
        bit obj_bit_exists    ; B634  2C A6 0A
        beq LB64E             ; B637  F0 15
        bit obj_bit_carried   ; B639  2C A5 0A
        bne LB64E             ; B63C  D0 10
        and #$1F              ; B63E  29 1F
        cmp $85               ; B640  C5 85
        bne LB64E             ; B642  D0 0A
        lda obj_col,x         ; B644  BD 00 0E
        cmp $84               ; B647  C5 84
        bne LB64E             ; B649  D0 03
        txa                   ; B64B  8A
        clc                   ; B64C  18
        rts                   ; B64D  60
LB64E:    ; <- B624 B62F B637 B63C B642 B649
        inx                   ; B64E  E8
        bne LB61F             ; B64F  D0 CE
LB651:    ; <- B608
        sec                   ; B651  38
        rts                   ; B652  60
verb_examine:    ; <- B403
        jsr jt_clear_text_rows; B653  20 06 95
        jsr find_object_under_player; B656  20 F0 B5
        bcc LB685             ; B659  90 2A
        jsr print_inline      ; B65B  20 09 80
        .byte $49,$C3,$54,$48,$45,$52,$45,$20,$49,$53,$20,$4E,$4F,$54,$48,$49; B65E  I.THERE IS NOTHI
        .byte $4E,$47,$20,$4F,$46,$20,$49,$4E,$54,$45,$52,$45,$53,$54,$20,$48; B66E  NG OF INTEREST H
        .byte $45,$52,$45,$FF                         ; B67E  ERE.
        jmp jt_verb_done      ; B682  4C 12 AC
LB685:    ; <- B659
        pha                   ; B685  48
        jsr print_inline      ; B686  20 09 80
        .byte $49,$C3,$49,$54,$20,$4C,$4F,$4F,$4B,$53,$20,$4C,$49,$4B,$45,$FF; B689  I.IT LOOKS LIKE.
        pla                   ; B699  68
        jsr jt_object_class   ; B69A  20 09 AC
        lda #$57              ; B69D  A9 57
        sta $80               ; B69F  85 80
        lda #$C3              ; B6A1  A9 C3
        sta $81               ; B6A3  85 81
        jsr jt_print_item_name; B6A5  20 0F AC
        jmp jt_verb_done      ; B6A8  4C 12 AC
        .byte $12,$AC,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B6AB  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B6BB  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B6CB  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B6DB  ................
        .byte $00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00,$00; B6EB  ................
        .byte $00,$00,$00,$00,$00                     ; B6FB  .....
