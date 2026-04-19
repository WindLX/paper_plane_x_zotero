(function() {
    // ================= 配置区 =================
    // 请将此处替换为你实际的 API 接口地址
    const API_URL = "http://127.0.0.1:8000/api/v1/papers"; 
    // ==========================================

    // 获取当前用户选中的所有条目
    var items = ZoteroPane.getSelectedItems();
    var curlCommands = [];

    // Bash 字符串安全转义函数：防止标题中的引号导致 curl 命令报错
    function bashEscape(str) {
        if (str === null || str === undefined) return "''";
        // 将内容用单引号包裹，并将内部的单引号替换为 '\''
        return "'" + String(str).replace(/'/g, "'\\''") + "'";
    }

    // 构造 -F 参数并整体转义，避免路径/值中的空格与特殊字符导致解析错误
    function curlFormField(name, value) {
        return `  -F ${bashEscape(`${name}=${value}`)}`;
    }

    function curlFormFile(name, filePath) {
        return `  -F ${bashEscape(`${name}=@${filePath}`)}`;
    }

    function curlFormFileFromShellVar(name, varName) {
        return `  -F "${name}=@$${varName}"`;
    }

    for (let item of items) {
        // 跳过笔记、独立附件等非标准文献条目
        if (!item.isRegularItem()) continue;

        // 1. 查找 PDF 文件路径 (API required 参数)
        let pdfPath = "";
        let attachmentIDs = item.getAttachments();
        for (let id of attachmentIDs) {
            let attachment = Zotero.Items.get(id);
            // 判断是否为 PDF
            if (attachment.attachmentContentType === 'application/pdf') {
                pdfPath = attachment.getFilePath();
                break; // 默认取找到的第一个 PDF
            }
        }
        
        // 如果没有找到本地 PDF 文件，则跳过该条目
        if (!pdfPath) {
            Zotero.debug("跳过: 没有本地 PDF 文件的条目 -> " + item.getField('title'));
            continue;
        }

        // 2. 提取 Title (论文标题)
        let title = item.getField('title') || "";

        // 3. 提取 Authors (作者列表，逗号分隔)
        let creators = item.getCreators();
        let authorsList = creators.map(c => {
            let name = c.lastName || "";
            if (c.firstName) name += " " + c.firstName;
            return name;
        }).join(", ");

        // 4. 提取 Year (发表年份)
        let year = "";
        let dateStr = item.getField('date');
        if (dateStr) {
            let yearMatch = dateStr.match(/\d{4}/); // 用正则提取 4 位数字年份
            if (yearMatch) year = yearMatch[0];
        }

        // 5. 提取 Publication (发表刊物/会议)
        let publication = "";
        try { publication = item.getField('publicationTitle'); } catch(e) {}
        if (!publication) {
            try { publication = item.getField('proceedingsTitle'); } catch(e) {} // 适配会议论文
        }

        // 6. 提取 DOI
        let doi = "";
        try { doi = item.getField('DOI'); } catch(e) {}

        // 7. 构造自定义 JSON 元数据 (可选填，这里举个例子把 Zotero Key 传过去)
        let customMeta = JSON.stringify({ zotero_key: item.key });

        // ================= 构造 Curl 命令 =================
        // 某些环境下 curl 对非 ASCII 文件名兼容性不稳定，先复制到临时 ASCII 文件名再上传
        let cmdLine = `(tmp_pdf=$(mktemp /tmp/zotero_pdf_XXXXXX.pdf) && cp ${bashEscape(pdfPath)} "$tmp_pdf" && \\\n`;

        // 使用 multipart/form-data 格式 (-F)
        cmdLine += `curl -X POST ${bashEscape(API_URL)} \\\n`;
        
        // PDF 文件 (必需) -> 注意使用 @ 符号表示上传文件
        cmdLine += curlFormFileFromShellVar('pdf_file', 'tmp_pdf');

        // 附加可选字段
        if (title)       cmdLine += ` \\\n${curlFormField('title', title)}`;
        if (authorsList) cmdLine += ` \\\n${curlFormField('authors', authorsList)}`;
        if (year)        cmdLine += ` \\\n${curlFormField('year', year)}`;
        if (publication) cmdLine += ` \\\n${curlFormField('publication', publication)}`;
        if (doi)         cmdLine += ` \\\n${curlFormField('doi', doi)}`;
        cmdLine += ` \\\n${curlFormField('custom_meta', customMeta)}`;
        cmdLine += `; rc=$?; rm -f "$tmp_pdf"; test $rc -eq 0)`;

        curlCommands.push(cmdLine);
    }

    // 检查是否有生成结果
    if (curlCommands.length === 0) {
        return "没有生成任何命令，请确保您选中了条目，且条目包含已下载的 PDF 附件。";
    }

    // 返回组装好的完整命令给输出框
    return curlCommands.join("\n\n");
})();