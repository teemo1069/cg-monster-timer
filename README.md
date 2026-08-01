# 魔物重生・經驗倍率帖

水藍魔力寶貝六服共用的 24 小時制魔物重生計時器。

## 功能

- 櫻之舞、卡連、露比、獅子、歌姬、雙子六服
- 依魔物出現時間計算三小時重生
- 使用完整日期時間運算，支援跨日
- 經驗倍率 1.0～2.0 倍
- 倍率由高至低排序，同倍率再依剩餘時間由多至少
- 互動式紙上水墨效果
- Supabase 後端管理員驗證、錯誤登入鎖定與八小時限時工作階段
- 首次安全登入強制更換新密碼

## GitHub Pages

推送到 `main` 後，GitHub Actions 會自動建置並部署：

https://teemo1069.github.io/cg-monster-timer/

若是第一次啟用，請在儲存庫的 `Settings → Pages` 將來源設為 `GitHub Actions`。

## 本機開發

```bash
npm ci
npm run dev
```

建立 GitHub Pages 靜態檔：

```bash
npm run build:pages
```

## 安全說明

公開程式碼只包含 Supabase 的 publishable key；它是設計給瀏覽器使用的公開識別。管理員密碼只以 PBKDF2 雜湊形式保存於後端，資料表已啟用 RLS 並撤銷公開讀取權限。Repair 與 AI 障礙排除在執行前會重新向後端驗證工作階段。

計時紀錄目前保留在使用者自己的瀏覽器中，因此不同裝置的紀錄彼此獨立。
