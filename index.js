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
app.get("/", (req, res) => res.status(200).send("에러 추적 모드 가동 중! ⚡"));
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log(`✅ [서버] 포트 개방!`));

// --- 2. 시스템 초기 설정 (URL 자동 청소 기능 탑재!) ---
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
const LOVE_KEYWORDS = [
    "좋아해", "사랑해", "너 좋아", "행복해", "조아해", "사릉해", "love you", "좋아해요",
    "사랑해요", "니가 좋아", "최고야", "멋져", "이쁘다", "예쁘다", "귀여워", "착해",
    "고마워", "기뻐", "love", "cute", "pretty", "thanks", "lovely",
];

// --- 3. 👑 초대형 전역 스타터팩 (100% 무생략 복구) ---
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

// --- 4. 비속어 필터 ---
let forbiddenWords = [];
async function updateBadWords() {
    try {
        const response = await axios.get("https://raw.githubusercontent.com/hlog2e/bad_word_list/master/word_list.json");
        forbiddenWords = response.data.words || response.data;
        console.log(`✅ [필터] 단어 로드 완료!`);
    } catch (e) { console.error(`❌ 비속어 로드 실패`); }
}

// --- 5. 명령어 등록 ---
client.once(Events.ClientReady, async () => {
    await updateBadWords();
    console.log(`✅ [로그인] ${client.user.tag} 온라인! (에러 추적 모드) ✨💖`);
    const commands = [
        new SlashCommandBuilder().setName("호감도").setDescription("나랑 얼마나 친한지 확인해봐! ✨").addUserOption(o => o.setName("유저").setDescription("누구꺼 볼까?")),
        new SlashCommandBuilder().setName("가르치기").setDescription("이린이에게 새로운 말을 가르쳐줘! 💖"),
        new SlashCommandBuilder().setName("셋팅").setDescription("대화 채널 설정 ⚙️").addChannelOption(o => o.setName("채널").setDescription("채널 선택").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        new SlashCommandBuilder().setName("호감도관리").setDescription("[관리자] 점수 조절 🛠️").setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName("유저").setDescription("유저 선택").setRequired(true)).addStringOption(o => o.setName("값").setDescription("숫자 입력").setRequired(true)),
    ].map(cmd => cmd.toJSON());
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
});

// --- 6. 인터랙션 (에러 자백 기능 포함) ---
client.on(Events.InteractionCreate, async (i) => {
    if (i.isButton() && i.customId === "like_button") {
        const userName = i.member?.displayName || i.user.username;
        return i.reply({ content: `헤헤, 나를 향한 **${userName}**의 마음이야! 💖`, flags: MessageFlags.Ephemeral });
    }
    
    if (i.isModalSubmit() && i.customId === "teachModal") {
        const key = i.fields.getTextInputValue("keywordInput");
        const res = i.fields.getTextInputValue("responseInput");

        await supabase.from("taught_words").delete().eq("guild_id", i.guildId).eq("keyword", key);
        
        const { error: insErr } = await supabase.from("taught_words").insert({ 
            guild_id: i.guildId, keyword: key, response: res, user_id: i.user.id 
        });

        if (insErr) {
            return i.reply({ content: `🚨 **[비상] DB 저장 실패!!**\n이유: \`${insErr.message}\`\n(이거 캡처해서 주인님한테 보여줘!!)` });
        }

        return i.reply({ content: `✨ **'${key}'**라고 말하면 **'${res}'**라고 대답할게!` });
    }

    if (!i.isChatInputCommand()) return;

    if (i.commandName === "호감도") {
        const target = i.options.getUser("유저") || i.user;
        let { data } = await supabase.from("user_affinity").select("score").eq("user_id", target.id).eq("guild_id", i.guildId).single();
        const score = data?.score || 0;
        let irinComment = score >= 300 ? `${target.username}님? 나랑 평생을 약속한 사이지!` : `${target.username}님? 처음보는 사람인데..`;
        const embed = new EmbedBuilder().setColor("#FFB6C1").setTitle(`이린아, ${target.username}님은 어떤 분이야?`).addFields({ name: "💬 이린이의 한마디", value: irinComment }, { name: "호감도 :", value: `💗 \`${score}\``, inline: true });
        return i.reply({ embeds: [embed] });
    }

    if (i.commandName === "가르치기") {
        const modal = new ModalBuilder().setCustomId("teachModal").setTitle("이린이 가르치기");
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("keywordInput").setLabel("들을 말").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("responseInput").setLabel("할 대답").setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return i.showModal(modal);
    }
    
    if (i.commandName === "셋팅") {
        const ch = i.options.getChannel("채널");
        
        // 🌟 [추가 로직] 셋팅 즉시 메모리에 반영해서 딜레이 없애기!
        settingsCache.set(i.guildId, ch.id); 

        await supabase.from("server_settings").upsert({ guild_id: i.guildId, ai_channel_id: ch.id });
        return i.reply({ content: `✅ 이제 ${ch} 채널에서 놀게! ✨`, flags: MessageFlags.Ephemeral });
    }

    if (i.commandName === "호감도관리") {
        if (i.user.id !== OWNER_ID) return i.reply({ content: "주인님만 가능해!", flags: MessageFlags.Ephemeral });
        const target = i.options.getUser("유저");
        const val = i.options.getString("값").toLowerCase();
        let { data } = await supabase.from("user_affinity").select("score").eq("user_id", target.id).eq("guild_id", i.guildId).single();
        let next = (data?.score || 0);
        if (val === "max") next = 9999; else if (val === "min") next = 0; else next += (parseInt(val) || 0);
        await supabase.from("user_affinity").upsert({ user_id: target.id, guild_id: i.guildId, score: next });
        return i.reply({ content: `✅ ${target.username} 점수 조절 완료! (\`${next}점\`)`, flags: MessageFlags.Ephemeral });
    }
});

// --- 7. 💖 대화 로직 ---
async function getGroqResponse(prompt, userName) {
    if (!GROQ_API_KEY) throw new Error("API_KEY_MISSING");
    const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: `너는 애교 넘치는 이린이야. 상대는 '${userName}'. 짧고 귀엽게 한국어로만 대답해!` },
                { role: "user", content: prompt }
            ],
            temperature: 0.8,
        },
        { headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" } }
    );
    return response.data.choices[0].message.content.trim();
}

client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) return; 
    if (!msg.content.startsWith("이린아")) return; 

    const now = Date.now();
    const cooldownAmount = 3000;
    if (cooldowns.has(msg.author.id)) {
        const expirationTime = cooldowns.get(msg.author.id) + cooldownAmount;
        if (now < expirationTime) return;
    }
    cooldowns.set(msg.author.id, now);

    let aiChannelId = settingsCache.get(msg.guildId);
    if (!aiChannelId) {
        const { data } = await supabase.from("server_settings").select("ai_channel_id").eq("guild_id", msg.guildId).single();
        if (data) { aiChannelId = data.ai_channel_id; settingsCache.set(msg.guildId, aiChannelId); } else return;
    }
    if (msg.channel.id !== aiChannelId) return;

    const content = msg.content.replace(/^이린아[!\s]*/, "").trim();
    if (!content) return msg.channel.send("웅? 왜 불러~? (๑>ᴗ<๑)");

    try {
        const userName = msg.member?.displayName || msg.author.username;
        const cleanPrompt = content.replace(/[\s!?~.,]/g, "").toLowerCase();

        // 🚨 [길드 ID 무시 긴급 수술] 서버 상관없이 키워드만 맞으면 다 불러오기!
        const { data: taughtData, error: dbError } = await supabase
            .from("taught_words")
            .select("keyword, response"); 

        if (dbError) {
            return msg.channel.send(`🚨 **창고(DB) 문이 잠겼어!**\n이유: \`${dbError.message}\``);
        }

        let matchedResponse = null;
        if (taughtData && taughtData.length > 0) {
            const found = taughtData.find(row => 
                row.keyword.trim() === content || 
                row.keyword.trim().replace(/[\s!?~.,]/g, "").toLowerCase() === cleanPrompt
            );
            if (found) matchedResponse = found.response;
        }

        if (matchedResponse) {
            return msg.channel.send(matchedResponse.replace(/{이름}/g, userName));
        }

        if (GLOBAL_RESPONSES[cleanPrompt]) {
            return msg.channel.send(GLOBAL_RESPONSES[cleanPrompt].replace(/{이름}/g, userName));
        }

        const responseText = await getGroqResponse(content, userName);
        await msg.channel.send(responseText);

    } catch (e) {
        console.error("🚨 엔진 오류:", e);
        msg.channel.send(`힝.. 주인아, 머리아파.. ㅠㅠ`);
    }
});

client.login(process.env.TOKEN);
