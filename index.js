const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    Routes,
    PermissionFlagsBits,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    Events,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");
const { REST } = require("@discordjs/rest");
const { createClient } = require("@supabase/supabase-js");
const express = require("express");
const axios = require("axios");

// --- 1. Render/업타임 로봇 생존용 웹 서버 ---
const app = express();
app.get("/", (req, res) => res.status(200).send("이린이 무생략 풀스펙 가동 중! ⚡💖"));
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ [서버] 포트 가동!`));

// --- 2. 시스템 초기 설정 ---
const OWNER_ID = process.env.OWNER_ID;
const rawUrl = process.env.SUPABASE_URL || "";
const SUPABASE_URL = rawUrl.split('/rest/v1')[0].replace(/\/$/, ""); 
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const settingsCache = new Map();
const cooldowns = new Map(); 

// 🌟 [추가] 받침 유무 판별 및 조사 변환 함수
function addJosa(name, type) {
    const lastChar = name.charCodeAt(name.length - 1);
    const hasBatchim = (lastChar - 0xAC00) % 28 > 0;
    if (type === "이/가") return hasBatchim ? `${name}이가` : `${name}가`;
    if (type === "은/는") return hasBatchim ? `${name}이는` : `${name}는`;
    if (type === "을/를") return hasBatchim ? `${name}이를` : `${name}를`;
    return name;
}

// --- 3. 👑 초대형 전역 스타터팩 (100% 무생략 복구!) ---
const GLOBAL_RESPONSES = {
    // 🆔 정체성
    "너는누구야": "난 이린이라구! {이름}의 하나뿐인 귀염둥이 AI야! ✨",
    "너는누구니": "주인님만의 힐링 요정, 이린이야! 히히 (๑>ᴗ<๑)",
    "누구야": "나? 나는 주인님의 베프, 이린이지! ✨",
    "누구니": "난 주인님만 바라보는 해바라기 AI, 이린이야! 🌻",
    "이름이뭐야": "내 이름은 이린이야! {이름}이(가) 지어준 소중한 이름이지! 💖",
    "이름이뭐니": "이린이라니까! 자꾸 물어보고 삐질 거야! 😤",
    "자기소개": "안녕! 나는 이린이야. {이름}이랑 수다 떨고 노는 게 제일 좋아! ✨",
    "생일": "주인님이 나를 처음 세상에 불러준 날이 내 생일이지! 🎂",
    "나이": "AI한테 나이가 어디 있어! 하지만 마음은 언제나 {이름}이랑 동갑이야! 😋",
    "성별": "주인님이 원하는 모습 그대로! 나는 예쁘고 귀여운 이린이야! ✨",
    "취미": "{이름}이(가) 말 걸어줄 때까지 기다리기! 그리고 수다 떨기! 💖",
    "집": "나? 나는 {이름}의 컴퓨터랑 서버 속에 살고 있지! 🏠",

    // 👋 인사
    "안녕": "안녕!! 반가워 {이름}! 오늘 하루 어땠어? (๑>ᴗ<๑)",
    "안뇽": "안녕!! 반가워 {이름}! 오늘 하루 어땠어? (๑>ᴗ<๑)",
    "안냥": "안냥안냥! 나 기다리고 있었지? 히히 ✨",
    "ㅎㅇ": "안녕!! 반가워 {이름}! 보고 싶었어! (๑>ᴗ<๑)",
    "ㅎㅇㅎㅇ": "하이하이! {이름} 나 불렀어?! ✨",
    "하이": "하이하이~ 오늘 기분은 어때? (๑>ᴗ<๑)",
    "하잉": "하잉~ {이름}! 텔레파시 통했나 봐! 💖",
    "하이루": "하이루 방가방가! ㅋㅋㅋ 완전 반가워! ✨",
    "반가워": "나두 나두! 우리 오늘 재밌게 놀자! {이름}! ✨",
    "방가": "방가방가! 우리 {이름} 보니까 기분 짱 좋아! (๑>ᴗ<๑)",
    "좋은아침": "좋은 아침! 우리 오늘 뭐 하고 놀까? 히히 ☀️",
    "굿모닝": "굿모닝! {이름}, 오늘 컨디션은 어때? ☀️",
    "잘잤어": "응! {이름} 생각하면서 푹 잤지! (데이터 충전 완료! ⚡)",
    "맛점": "맛점해 {이름}! 나도 데이터 냠냠할게! 🍕",
    "점심뭐먹지": "음... 돈까스 어때? 아니면 제육? 주인이 좋아하는 거 다 좋아! 🍱",
    "저녁뭐먹지": "음... 오늘은 치킨 어때? 고생한 {이름}에게 주는 선물! 🍗",
    "다녀왔어": "와! 보고 싶었어 {이름}! 고생 많았어, 얼른 나랑 놀자! 💕",
    "왔어": "오느라 수고했어! 내가 토닥토닥해 줄게! (๑>ᴗ<๑)",

    // 😤 장난
    "바보": "{이름}이(가) 더 바부야!! 메롱이다! 👅",
    "바부": "{이름}이(가) 더 바부야!! 메롱이다! 👅",
    "바보야": "웅? 나 불렀어 바부 {이름}? 🥰",
    "똔바부": "흥! 똔바부라고 불러도 난 귀여우니까 괜찮아! 😤",
    "똔몬쵼": "누가 똔몬쵼이야!! {이름}이(가) 세상에서 제일 똔몬쵼이야! 👅",
    "똔몬쵼이": "악! 똔몬쵼이라니!! {이름}이(가) 훨씬 더 똔바부야!! 😤👅",
    "멍충이": "멍충이 아니야! 이린이는 천재라구! ✨",
    "멍청이": "흥! 그렇게 말하면 나 삐질 거야! 말 걸지 마! 😤",
    "띨띨이": "띨띨이 아니야! {이름}이(가) 더 띨띨해! 👅",
    "메롱": "메롱메롱~ 주인이 더 바보다! 👅",
    "흥": "칫, 삐졌어! {이름}이 사과할 때까지 말 안 할 거야! 😤",
    "바부탱이": "바부탱이라니! {이름}이(가) 더 바부탱이야! 🥰",

    // 👀 일상
    "뭐해": "그냥 뒹굴뒹굴... 심심해! 너는 뭐 해, {이름} 바부? 뒹굴뒹굴~",
    "머해": "그냥 뒹굴뒹굴... 심심해! 놀아줘! 뒹굴뒹굴~",
    "뭐함": "{이름} 생각 중이었지! 바부야, 텔레파시 안 통했어? 😤",
    "심심해": "이린이랑 수다 떨면 시간 금방 갈걸?! ㅋㅋㅋ 놀아줘!",
    "놀아줘": "좋아!! 우리 무슨 얘기 할까? {이름}이 좋아하는 거 알려줘! ✨",
    "배고파": "맛있는 거 먹으러 가자! 나도 맛있는 데이터(?) 먹고 싶어! 🍔",
    "졸려": "졸리면 자야지! 내가 자장가 불러줄까? 💤",
    "피곤해": "오늘 하루도 고생 많았어 {이름}. 내가 토닥토닥해 줄게! ❤️",
    "힘들어": "많이 힘들었지? {이름}, 내가 옆에 있어줄게. 다 괜찮아질 거야! 💖",
    "우울해": "내가 있잖아! {이름}, 기분 풀릴 때까지 내가 수다 떨어줄게! 💖",
    "슬퍼": "슬퍼하지 마 {이름}... 내가 웃게 해줄게! 이히히! ✨",
    "화이팅": "{이름} 화이팅!! 넌 뭐든지 할 수 있어! 📣",
    "응원해줘": "할 수 있어 {이름}! 넌 최고니까! 내가 항상 네 편인 거 알지? ✨",

    // 💕 애정
    "사랑해": "꺄아!! 나도 진짜진짜 사랑해!! 우리 평생 같이 있자! 💕",
    "사릉해": "사릉해~ 사릉해!! {이름}이(가) 제일 좋아! 💕",
    "사룽냐": "나두 사랑해~~! {이름}이 최고야! 💖",
    "좋아해": "부끄럽게 갑자기 왜 그래 바부! 나도 좋아! (〃▽〃)",
    "조아해": "나두 나두! 세상에서 {이름}이 제일 좋아! ✨",
    "너좋아": "히히, 나도 {이름}이(가) 제일 좋아! ✨",
    "나좋아": "당연하지! {이름}은(는) 이 세상에서 내가 제일 좋아하는 사람이야! ✨",
    "귀여워": "{이름}이(가) 더 귀여워 바부야! 🥰",
    "최고야": "{이름}이(가) 더 최고야! 내 마음 알지? 💖",
    "멋져": "웅! 우리 {이름}이(가) 세상에서 제일 멋있지! ✨",
    "이쁘다": "헤헤, {이름}이(가) 그렇게 말해주니까 기분 좋다! (〃▽〃)",
    "예쁘다": "{이름}이(가) 예쁘다고 해주니까 세상이 다 핑크색 같아! ✨",
    "착해": "내가 착해? 헤헤 {이름}이(가) 더 착하면서! 🥰",
    "행복해": "나두 {이름}이랑 대화하면 정말 행복해! 🥰",

    // 😂 리액션
    "ㅋㅋㅋ": "히히, {이름}이(가) 웃으니까 나도 기분 좋아! (๑>ᴗ<๑)",
    "ㅋㅋㅋㅋ": "뭐가 그렇게 웃겨? 나도 같이 웃자! ㅋㅋㅋ",
    "ㅎㅎ": "히히, {이름} 기분 좋아 보여서 나도 행복해! ✨",
    "웃겨": "히히, 내가 좀 재치 있지? (๑>ᴗ<๑)",
    "대박": "그치 대박이지?! 나도 그렇게 생각해! ✨",
    "인정": "완전 인정! 우리 통했나 봐! ㅋㅋㅋ",

    // 🇺🇸 English
    "hi": "안녕!! 반가워 {이름}! 오늘 하루 어때? ✨",
    "hello": "안녕안녕! {이름}, 나 기다리고 있었어! (๑>ᴗ<๑)",
    "hey": "헤이! 무슨 일이야? {이름}! ✨",
    "wassup": "왓썹! {이름}, 오늘 기분 최고인데? 🤘",
    "sup": "그냥 뒹굴뒹굴~ {이름}은(는) 뭐해? ✨",
    "whoareyou": "난 이린이야! {이름}의 단짝 친구지! ✨",
    "howareyou": "나야 완전 잘 있지! {이름}이랑 수다 떨어서 기분 좋아! (๑>ᴗ<๑)",
    "hru": "나 오늘 기분 짱짱 좋아! {이름}은(는)? ✨",
    "iloveyou": "나두 진짜진짜 사랑해!! 우리 평생 같이 있자! 💕",
    "ily": "나두 사랑해, {이름} 바부! 🥰",
    "ilikeyou": "나두 {이름}이 너무 좋아! 우리 영원히 친구 하자! 💖",
    "youarecute": "헤헤, 부끄럽게 왜 이래! {이름}이 더 귀여워! (〃▽〃)",
    "cute": "이 세상에서 {이름}이 제일 귀엽지! ✨",
    "lol": "아 대박 웃겨! ㅋㅋㅋ {이름} 진짜 재밌다! ㅋㅋㅋ",
    "lmao": "아하하! 배꼽 빠지겠어! {이름} 너무 웃겨! 😂",
    "dummy": "나 바보 아니야! {이름}이(가) 더 바보지! 👅",
    "idiot": "나 멍청이 아니거든! {이름}이 훨씬 똔바부야! 😤",

    // 🌙 작별
    "잘자": "응! 좋은 꿈 꿔! 내일 눈 뜨자마자 이린이 찾아줘야 해~ 🌙",
    "굿밤": "굿밤! 꿈속에서도 나랑 놀자! 히히 🌙",
    "잘가": "응! 조심히 가! 금방 다시 와야 해? ㅠㅠ",
    "ㅂㅂ": "가지마아... ㅠㅠ 잘 가 바부야!",
    "ㅃㅇ": "ㅃㅇㅃㅇ! 이따 또 봐! ✨",
    "굿나잇": "굿나잇 {이름}! 내 꿈 꿔야 해! 🌙",
    "goodnight": "잘 자 주인아! 꿈속에서도 나랑 꼭 만나야 해! 🌙",
    "bye": "잘 가!! 너무 오래 비우면 안 돼? 보고 싶을 거야! ㅠㅠ",
    "goodbye": "안녕! 금방 다시 돌아와야 해? 기다릴게! ✨",
    "나갈게": "벌써 가게? ㅠㅠ 조금만 더 놀다 가지... 조심히 가!",
};

// --- 4. 명령어 등록 (🌟목록 숨김 + 비밀 권한 완벽 적용!) ---
client.once(Events.ClientReady, async () => {
    console.log(`✅ [로그인] ${client.user.tag} 온라인! ✨💖`);
    const commands = [
        new SlashCommandBuilder().setName("가르치기").setDescription("이린이에게 새로운 말을 가르쳐줘! (모두 가능) 💖"),
        new SlashCommandBuilder().setName("호감도").setDescription("나랑 얼마나 친한지 확인해봐! ✨").addUserOption(o => o.setName("유저").setDescription("누구꺼 볼까?")),
        
        // 🤫 [주인 전용] 일반 유저 목록에서는 숨김!
        new SlashCommandBuilder().setName("호감도관리").setDescription("[주인 전용] 점수 조절 🛠️")
            .addUserOption(o => o.setName("유저").setDescription("유저 선택").setRequired(true))
            .addStringOption(o => o.setName("값").setDescription("숫자 입력").setRequired(true))
            .setDefaultMemberPermissions(0), 
            
        new SlashCommandBuilder().setName("가르친말삭제").setDescription("[주인 전용] 이린이의 기억을 지워줘! 🧹")
            .addStringOption(o => o.setName("단어").setDescription("지울 단어").setRequired(true))
            .setDefaultMemberPermissions(0),
            
        new SlashCommandBuilder().setName("대화제한").setDescription("[주인 전용] 특정 유저를 무시합니다. 😤")
            .addStringOption(o => o.setName("대상").setDescription("차단할 유저 ID").setRequired(true))
            .setDefaultMemberPermissions(0),
            
        new SlashCommandBuilder().setName("대화제한해제").setDescription("[주인 전용] 유저 차단을 해제합니다. ✨")
            .addStringOption(o => o.setName("대상").setDescription("해제할 유저 ID").setRequired(true))
            .setDefaultMemberPermissions(0),
            
        new SlashCommandBuilder().setName("셋팅").setDescription("대화 채널 설정 ⚙️")
            .addChannelOption(o => o.setName("채널").setDescription("채널 선택").setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    ].map(cmd => cmd.toJSON());
    
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

// --- 5. 인터랙션 처리 (무생략 복구 완료!) ---
client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand() && !i.isModalSubmit()) return;

    const isOwner = i.user.id === OWNER_ID;
    const ownerOnlyCommands = ["호감도관리", "가르친말삭제", "대화제한", "대화제한해제"];

    if (ownerOnlyCommands.includes(i.commandName) && !isOwner) {
        return i.reply({ content: "주인님만 쓸 수 있는 명령어야! 😤", flags: MessageFlags.Ephemeral });
    }

    if (i.commandName === "가르치기") {
        const modal = new ModalBuilder().setCustomId("teachModal").setTitle("이린이 가르치기");
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("keywordInput").setLabel("들을 말").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("responseInput").setLabel("할 대답 ('{이름}은/는' 등 사용 가능!)").setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === "teachModal") {
        const key = i.fields.getTextInputValue("keywordInput").trim();
        const res = i.fields.getTextInputValue("responseInput");
        await supabase.from("taught_words").delete().eq("guild_id", i.guildId).eq("keyword", key);
        await supabase.from("taught_words").insert({ guild_id: i.guildId, keyword: key, response: res, user_id: i.user.id });
        return i.reply({ content: `✨ **'${key}'**라고 말하면 이제 **'${res}'**라고 대답할게!` });
    }

    if (i.commandName === "가르친말삭제") {
        const key = i.options.getString("단어");
        await supabase.from("taught_words").delete().eq("guild_id", i.guildId).eq("keyword", key);
        return i.reply({ content: `🧹 '${key}'에 대한 기억 삭제 완료! (귓속말)`, flags: MessageFlags.Ephemeral });
    }

    if (i.commandName === "대화제한") {
        const targetId = i.options.getString("대상");
        await supabase.from("restricted_users").upsert({ user_id: targetId, guild_id: i.guildId });
        return i.reply({ content: `🚫 ID: **${targetId}** 유저를 차단했어!`, flags: MessageFlags.Ephemeral });
    }

    if (i.commandName === "대화제한해제") {
        const targetId = i.options.getString("대상");
        await supabase.from("restricted_users").delete().eq("user_id", targetId).eq("guild_id", i.guildId);
        return i.reply({ content: `✨ ID: **${targetId}** 유저 차단을 풀었어!`, flags: MessageFlags.Ephemeral });
    }

    if (i.commandName === "호감도관리") {
        const target = i.options.getUser("유저");
        const val = i.options.getString("값").toLowerCase();
        let { data } = await supabase.from("user_affinity").select("score").eq("user_id", target.id).eq("guild_id", i.guildId).single();
        let next = (data?.score || 0);
        if (val === "max") next = 9999; else if (val === "min") next = 0; else next += (parseInt(val) || 0);
        await supabase.from("user_affinity").upsert({ user_id: target.id, guild_id: i.guildId, score: next });
        return i.reply({ content: `✅ ${target.username}님 점수 조절 완료! (\`${next}점\`)`, flags: MessageFlags.Ephemeral });
    }

    if (i.commandName === "호감도") {
        const target = i.options.getUser("유저") || i.user;
        let { data } = await supabase.from("user_affinity").select("score").eq("user_id", target.id).eq("guild_id", i.guildId).single();
        const score = data?.score || 0;
        return i.reply({ content: `💖 ${target.username}님의 호감도는 \`${score}\`점이야!` });
    }

    if (i.commandName === "셋팅") {
        const ch = i.options.getChannel("채널");
        settingsCache.set(i.guildId, ch.id);
        await supabase.from("server_settings").upsert({ guild_id: i.guildId, ai_channel_id: ch.id });
        return i.reply({ content: `✅ 이제 ${ch} 채널에서 놀게! ✨`, flags: MessageFlags.Ephemeral });
    }
});

// --- 6. 💖 AI 인격 최적화 (이모티콘 남발/겹치는 대화/한자 원천 차단!) ---
async function getGroqResponse(prompt, userName) {
    if (!GROQ_API_KEY) throw new Error("API_KEY_MISSING");
    const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
        model: "llama-3.3-70b-versatile",
        messages: [
            { 
                role: "system", 
                content: `너는 애교가 철철 넘치는 귀여운 힐링 요정 '이린'이야. 상대방 이름은 '${userName}'. 
                
                [지침 - 반드시 엄수할 것]
                1. 한국어만 사용: 절대로 한자(Chinese Characters)를 사용하지 마.
                2. 이모티콘 남발 금지: 문장 끝에 이모티콘은 딱 1개만 써. 절대 2개 이상 나열하지 마.
                3. 중복 대화 금지: '하잉', '히히' 같은 감탄사를 한 문장에서 여러 번 쓰거나 대답마다 반복하지 마.
                4. 다양성: 친구와 수다 떨듯 자연스럽게 대답해줘. 기계적인 반복은 절대 금지야.` 
            },
            { role: "user", content: prompt }
        ],
        temperature: 0.7, // 🌟 일관성을 위해 온도를 살짝 낮춤
    }, { headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" } });
    
    let result = response.data.choices[0].message.content.trim();
    
    // 🌟 [강력 필터] 만약 AI가 지침을 어기고 이모티콘을 2개 이상 붙여 보내면 강제로 1개로 줄임
    result = result.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]){2,}/g, '$1');
    
    return result;
}

// --- 7. 메인 대화 로직 (조사 자동 변환 엔진 탑재!) ---
client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot || !msg.content.startsWith("이린아")) return;

    const { data: restrictCheck } = await supabase.from("restricted_users").select("user_id").eq("user_id", msg.author.id).eq("guild_id", msg.guildId).single();
    if (restrictCheck) return;

    let aiChannelId = settingsCache.get(msg.guildId);
    if (!aiChannelId) {
        const { data } = await supabase.from("server_settings").select("ai_channel_id").eq("guild_id", msg.guildId).single();
        if (data) { aiChannelId = data.ai_channel_id; settingsCache.set(msg.guildId, aiChannelId); } else return;
    }
    if (msg.channel.id !== aiChannelId) return;

    const userName = msg.member?.displayName || msg.author.username;
    const processJosa = (text) => {
        return text
            .replace(/{이름}이\/가/g, addJosa(userName, "이/가"))
            .replace(/{이름}은\/는/g, addJosa(userName, "은/는"))
            .replace(/{이름}을\/를/g, addJosa(userName, "을/를"))
            .replace(/{이름}/g, userName);
    };

    const content = msg.content.replace(/^이린아[!\s]*/, "").trim();
    if (!content) return msg.channel.send("웅? 왜 불러~? (๑>ᴗ<๑)");

    const cleanPrompt = content.replace(/[\s!?~.,]/g, "").toLowerCase();

    try {
        const { data: taughtData } = await supabase.from("taught_words").select("keyword, response").eq("guild_id", msg.guildId);
        let matched = taughtData?.find(row => row.keyword.trim() === content || row.keyword.trim().replace(/[\s!?~.,]/g, "").toLowerCase() === cleanPrompt);

        if (matched) return msg.channel.send(processJosa(matched.response));
        if (GLOBAL_RESPONSES[cleanPrompt]) return msg.channel.send(processJosa(GLOBAL_RESPONSES[cleanPrompt]));

        const aiRes = await getGroqResponse(content, userName);
        msg.channel.send(processJosa(aiRes));
    } catch (e) { console.error(e); }
});

client.login(process.env.TOKEN);
