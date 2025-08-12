#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '..', 'works.nantoka.droidcam.sdPlugin', 'manifest.json');

async function incrementBuildNumber() {
    // 環境変数でスキップ設定を確認
    if (process.env.SKIP_VERSION_INCREMENT === 'true') {
        console.log('⏭️  Skipping version increment (SKIP_VERSION_INCREMENT=true)');
        process.exit(0);
    }
    
    try {
        // manifest.jsonを読み込み
        const manifestContent = await readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        
        // 現在のバージョンを取得
        const currentVersion = manifest.Version;
        console.log(`Current version: ${currentVersion}`);
        
        // バージョンを分解 (Major.Minor.Patch.Build)
        const versionParts = currentVersion.split('.');
        
        if (versionParts.length !== 4) {
            console.error('Version format should be Major.Minor.Patch.Build');
            process.exit(1);
        }
        
        // ビルド番号をインクリメント
        const buildNumber = parseInt(versionParts[3], 10);
        versionParts[3] = (buildNumber + 1).toString();
        
        // 新しいバージョンを作成
        const newVersion = versionParts.join('.');
        manifest.Version = newVersion;
        
        // manifest.jsonを更新（整形して保存）
        const updatedContent = JSON.stringify(manifest, null, '\t');
        await writeFile(manifestPath, updatedContent + '\n', 'utf-8');
        
        console.log(`✅ Version updated to: ${newVersion}`);
        
    } catch (error) {
        console.error('❌ Error incrementing build number:', error);
        process.exit(1);
    }
}

// スクリプトを実行
incrementBuildNumber();