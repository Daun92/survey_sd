// src/dom.js
var _DOMParser = typeof globalThis !== "undefined" && typeof globalThis.DOMParser !== "undefined" ? globalThis.DOMParser : null;
function setDOMParser(impl) {
  _DOMParser = impl;
}
function getDOMParser() {
  if (!_DOMParser) {
    throw new Error(
      '[bris-parser] DOMParser is not available. In Node.js: `import { DOMParser } from "linkedom"; setDOMParser(DOMParser);` before parsing.'
    );
  }
  return _DOMParser;
}

// src/utils.js
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function normalizeText(str) {
  if (!str) return "";
  return str.replace(/[\u00a0\u3000\u200b]/g, " ").trim();
}
function normalizePhone(raw) {
  if (!raw) return "";
  let s = raw.replace(/^[가-힣\s:：]+/, "").trim();
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("02")) {
    if (digits.length <= 9) return digits.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3");
    return digits.replace(/^(02)(\d{4})(\d{4})$/, "$1-$2-$3");
  }
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3");
  if (digits.length === 10) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
  return digits;
}
function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function normalizeDate(str) {
  if (!str) return "";
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return str;
}
function parseBrisDate(str) {
  str = (str || "").trim();
  const arrowMatch = str.match(/(\d{4})\/(\d{2})\/(\d{2})[→~](\d{2})\/(\d{2})/);
  if (arrowMatch) {
    const startDate = `${arrowMatch[1]}-${arrowMatch[2]}-${arrowMatch[3]}`;
    const endDate = `${arrowMatch[1]}-${arrowMatch[4]}-${arrowMatch[5]}`;
    return { startDate, endDate };
  }
  const singleMatch = str.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (singleMatch) {
    const d = `${singleMatch[1]}-${singleMatch[2]}-${singleMatch[3]}`;
    return { startDate: d, endDate: d };
  }
  return { startDate: "", endDate: "" };
}
function normalizeTeamName(raw) {
  if (!raw) return "";
  const m = raw.match(/^\d+\s*-\s*(.+)$/);
  return m ? m[1].trim() : raw.trim();
}

// src/label-values.js
function extractLabelValues(row) {
  const result = {};
  row.querySelectorAll("span").forEach((span) => {
    const b = span.querySelector("b");
    if (!b) return;
    const label = b.textContent.replace(/[:：]\s*$/, "").trim();
    if (!label) return;
    const parts = [];
    let sib = b.nextSibling;
    while (sib) {
      if (sib.nodeType === 1) {
        if (sib.tagName === "B") break;
        if (sib.tagName === "SPAN" && sib.querySelector("b")) break;
      }
      parts.push(sib.textContent != null ? sib.textContent : sib.nodeValue || "");
      sib = sib.nextSibling;
    }
    const value = parts.join("").trim();
    if (!(label in result)) result[label] = value;
  });
  return result;
}

// src/integrated.js
function extractIntegratedData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table.ntbl_list_c");
  if (!table) return [];
  const allRows = table.querySelectorAll("tr");
  const records = [];
  let i = 0;
  while (i < allRows.length && allRows[i].classList.contains("tfirst")) i++;
  function isInfoRow(tr) {
    if (tr.classList.contains("info-row")) return true;
    const firstTd = tr.querySelector("td");
    return firstTd && firstTd.classList.contains("info-row");
  }
  while (i < allRows.length) {
    const row = allRows[i];
    if (isInfoRow(row)) {
      i++;
      continue;
    }
    const tds = row.querySelectorAll("td");
    if (tds.length < 12) {
      i++;
      continue;
    }
    const idCell = tds[0].textContent;
    const bizMatch = idCell.match(/business_id\s*:\s*(\d+)/);
    const projMatch = idCell.match(/project_id\s*:\s*(\d+)/);
    const echoMatch = idCell.match(/echo_id\s*:\s*(\d+)/);
    const custMatch = idCell.match(/customer_id\s*:\s*(\d+)/);
    const businessId = bizMatch ? bizMatch[1] : "";
    const projectId = projMatch ? projMatch[1] : "";
    const echoId = echoMatch ? echoMatch[1] : "";
    const customerId = custMatch ? custMatch[1] : "";
    const courseName = tds[1].textContent.trim();
    const programName = tds[2].textContent.trim();
    const totalRevenue = tds[3].textContent.trim();
    const startDate = normalizeDate(tds[4].textContent.trim());
    const endDate = normalizeDate(tds[5].textContent.trim());
    const eduDelivery = tds[6].textContent.trim().replace(/\s+/g, "");
    const orderCode = tds[7].textContent.trim();
    const projectName = tds[8].textContent.trim();
    const registrationDate = tds[9].textContent.trim();
    const orderDate = tds[10].textContent.trim();
    const closeDateTd = tds[11];
    const redSpan = closeDateTd.querySelector('span[style*="color:red"], span[style*="color: red"]');
    const projectClosed = redSpan && redSpan.textContent.trim() ? redSpan.textContent.trim() : "\uBBF8\uC801\uC6A9";
    const record = {
      businessId,
      projectId,
      echoId,
      customerId,
      courseName,
      programName,
      totalRevenue,
      startDate,
      endDate,
      eduDelivery,
      orderCode,
      projectName,
      registrationDate,
      orderDate,
      projectClosed,
      echoStatus: "",
      am: "",
      amTeam: "",
      performer: "",
      performerTeam: "",
      instructor: "",
      internalInstructors: "",
      externalInstructors: "",
      company: "",
      businessNumber: "",
      placeName: "",
      dmName: "",
      dmDept: "",
      dmEmail: "",
      dmPhone: "",
      dmMobile: ""
    };
    i++;
    while (i < allRows.length) {
      const infoRow = allRows[i];
      if (!isInfoRow(infoRow)) break;
      const infoText = infoRow.textContent;
      const lv = extractLabelValues(infoRow);
      if (infoText.includes("\uC5D0\uCF54 \uC0C1\uD0DC")) {
        if (lv["\uC5D0\uCF54 \uC0C1\uD0DC"]) record.echoStatus = lv["\uC5D0\uCF54 \uC0C1\uD0DC"];
        else {
          const statusMatch = infoText.match(/에코 상태\s*:\s*(.+?)$/m);
          if (statusMatch) record.echoStatus = statusMatch[1].trim();
        }
        const echoRedSpan = infoRow.querySelector('span[style*="color: red"], span[style*="color:red"]');
        if (echoRedSpan && echoRedSpan.textContent.includes("\uC5D0\uCF54 \uC81C\uC678")) {
          record.echoStatus = "\uC5D0\uCF54 \uC81C\uC678";
        }
      } else if (infoText.includes("\uC218\uC8FC :") && infoText.includes("\uC218\uC8FC\uD300")) {
        record.am = lv["\uC218\uC8FC"] || "";
        record.amTeam = (lv["\uC218\uC8FC\uD300"] || "").replace(/^\(|\)$/g, "");
        record.performer = lv["\uC218\uD589"] || "";
        const perfTeam = (lv["\uC218\uD589\uD300"] || "").replace(/^\(|\)$/g, "");
        if (perfTeam) record.performerTeam = normalizeTeamName(perfTeam);
        if (!record.am) {
          const amMatch = infoText.match(/수주\s*:\s*(\S+)/);
          if (amMatch) record.am = amMatch[1].trim();
        }
        if (!record.amTeam) {
          const amTeamMatch = infoText.match(/수주팀\s*:\s*\(([^)]+)\)/);
          if (amTeamMatch) record.amTeam = amTeamMatch[1].trim();
        }
        if (!record.performer) {
          const perfMatch = infoText.match(/수행\s*:\s*(\S+)/);
          if (perfMatch) record.performer = perfMatch[1].trim();
        }
        if (!record.performerTeam) {
          const perfTeamMatch = infoText.match(/수행팀\s*:\s*\(([^)]+)\)/);
          if (perfTeamMatch) record.performerTeam = normalizeTeamName(perfTeamMatch[1].trim());
        }
      } else if (infoText.includes("\uC0AC\uB0B4\uAC15\uC0AC") && !infoText.includes("\uC678\uBD80\uAC15\uC0AC")) {
        record.internalInstructors = lv["\uC0AC\uB0B4\uAC15\uC0AC"] || "";
        if (!record.internalInstructors) {
          const m = infoText.match(/사내강사\s*:\s*(.+?)$/m);
          if (m) record.internalInstructors = m[1].trim();
        }
      } else if (infoText.includes("\uC678\uBD80\uAC15\uC0AC") && !infoText.includes("\uC0AC\uB0B4\uAC15\uC0AC")) {
        record.externalInstructors = lv["\uC678\uBD80\uAC15\uC0AC"] || "";
        if (!record.externalInstructors) {
          const m = infoText.match(/외부강사\s*:\s*(.+?)$/m);
          if (m) record.externalInstructors = m[1].trim();
        }
      } else if (infoText.includes("\uC0AC\uB0B4\uAC15\uC0AC") && infoText.includes("\uC678\uBD80\uAC15\uC0AC")) {
        record.internalInstructors = lv["\uC0AC\uB0B4\uAC15\uC0AC"] || "";
        record.externalInstructors = lv["\uC678\uBD80\uAC15\uC0AC"] || "";
        if (!record.internalInstructors) {
          const m = infoText.match(/사내강사\s*:\s*(.+?)(?=\s*외부강사|$)/);
          if (m) record.internalInstructors = m[1].trim();
        }
        if (!record.externalInstructors) {
          const m = infoText.match(/외부강사\s*:\s*(.+?)$/m);
          if (m) record.externalInstructors = m[1].trim();
        }
      } else if (infoText.includes("\uAC15\uC0AC") && !infoText.includes("\uC0AC\uB0B4\uAC15\uC0AC") && !infoText.includes("\uC678\uBD80\uAC15\uC0AC")) {
        const instrMatch = infoText.match(/강사\s*:\s*(.+?)$/m);
        if (instrMatch) record.instructor = instrMatch[1].trim();
      } else if (infoText.includes("\uD68C\uC0AC\uBA85") && infoText.includes("\uC0AC\uC5C5\uC790\uBC88\uD638")) {
        record.company = lv["\uD68C\uC0AC\uBA85"] || "";
        record.businessNumber = lv["\uC0AC\uC5C5\uC790\uBC88\uD638"] || "";
        record.placeName = lv["\uC0AC\uC5C5\uC7A5\uBA85"] || "";
        if (!record.company) {
          const compMatch = infoText.match(/회사명\s*:\s*(.+?)(?=\s*사업자번호|$)/);
          if (compMatch) record.company = compMatch[1].trim();
        }
        if (!record.businessNumber) {
          const bizNumMatch = infoText.match(/사업자번호\s*:\s*(\S*)/);
          if (bizNumMatch) record.businessNumber = bizNumMatch[1].trim();
        }
        if (!record.placeName) {
          const placeMatch = infoText.match(/사업장명\s*:\s*(.+?)$/m);
          if (placeMatch) record.placeName = placeMatch[1].trim();
        }
      } else if (infoText.includes("\uB2F4\uB2F9\uC790") && infoText.includes("\uC774\uBA54\uC77C")) {
        record.dmName = lv["\uB2F4\uB2F9\uC790"] || "";
        record.dmDept = lv["\uBD80\uC11C"] || "";
        record.dmEmail = lv["\uC774\uBA54\uC77C"] || "";
        record.dmPhone = lv["\uC804\uD654"] || "";
        record.dmMobile = lv["\uD734\uB300"] || "";
        if (!record.dmName) {
          const nameMatch = infoText.match(/담당자\s*:\s*(.+?)(?=\s*(?:부서|이메일|전화|휴대|$))/);
          if (nameMatch && nameMatch[1].trim()) record.dmName = nameMatch[1].trim();
        }
        if (!record.dmDept) {
          const deptMatch = infoText.match(/부서\s*:\s*(.+?)(?=\s*(?:이메일|전화|휴대|$))/);
          if (deptMatch && deptMatch[1].trim()) record.dmDept = deptMatch[1].trim();
        }
        if (!record.dmEmail) {
          const emailMatch = infoText.match(/이메일\s*:\s*(.+?)(?=\s*(?:전화|휴대|$))/);
          if (emailMatch && emailMatch[1].trim()) record.dmEmail = emailMatch[1].trim();
        }
        if (!record.dmPhone) {
          const phoneMatch = infoText.match(/전화\s*:\s*([\d\-\s]+)/);
          if (phoneMatch && phoneMatch[1].trim()) record.dmPhone = phoneMatch[1].trim();
        }
        if (!record.dmMobile) {
          const mobileMatch = infoText.match(/휴대\s*:\s*([\d\-\s]+)/);
          if (mobileMatch && mobileMatch[1].trim()) record.dmMobile = mobileMatch[1].trim();
        }
      }
      i++;
    }
    const combinedInstr = [record.internalInstructors, record.externalInstructors].filter(Boolean).join(", ");
    if (combinedInstr) record.instructor = combinedInstr;
    records.push(record);
  }
  return records;
}

// src/edu-detail.js
function extractEduDetailData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const bizInput = doc.querySelector('input[id="businessId"], input[name="businessId"], input[name="business_id"]');
  const businessId = bizInput ? bizInput.value : "";
  let orderCode = "", projectId = "";
  const projectLink = doc.querySelector('a[href*="project_view.asp"]');
  if (projectLink) {
    orderCode = projectLink.textContent.trim();
    const pidMatch = (projectLink.getAttribute("href") || "").match(/PROJECT_ID=(\d+)/);
    projectId = pidMatch ? pidMatch[1] : "";
  }
  const tdHeaders = doc.querySelectorAll('td[bgcolor="#DDECB4"]');
  let company = "", internalManager = "", courseName = "", programName = "";
  let customerId = "", customerName = "";
  for (const th of tdHeaders) {
    const text = normalizeText(th.textContent).replace(/\*/g, "");
    const nextTd = th.nextElementSibling;
    if (!nextTd) continue;
    const val = normalizeText(nextTd.textContent);
    if (text === "\uD68C\uC0AC\uBA85") company = val;
    else if (text === "\uB2F4\uB2F9\uC790") {
      internalManager = val;
      customerId = nextTd.getAttribute("data-customer-id") || "";
      customerName = nextTd.getAttribute("data-customer-name") || "";
      if (!customerId) {
        const dmLink = nextTd.querySelector('a[href*="dm_view.asp"], a[href*="CUSTOMER_ID"]');
        if (dmLink) {
          const cidMatch = (dmLink.getAttribute("href") || "").match(/CUSTOMER_ID=(\d+)/);
          if (cidMatch) customerId = cidMatch[1];
          if (!customerName) customerName = dmLink.textContent.trim();
        }
      }
    } else if (text === "\uACFC\uC815\uBA85") courseName = val;
    else if (text === "\uD504\uB85C\uADF8\uB7A8\uBA85") programName = val;
  }
  if (!customerId) {
    const dmLinkFallback = doc.querySelector('a[href*="dm_view.asp"]');
    if (dmLinkFallback) {
      const cidMatch = (dmLinkFallback.getAttribute("href") || "").match(/CUSTOMER_ID=(\d+)/);
      if (cidMatch) customerId = cidMatch[1];
      if (!customerName) customerName = dmLinkFallback.textContent.trim();
    }
  }
  const instructorLinks = doc.querySelectorAll('a[href*="inst_fee_edit.asp"]');
  const instructors = [...instructorLinks].map((a) => a.textContent.trim()).filter(Boolean);
  let facilitators = [];
  const alMatch = html.match(/al_person\s*:\s*\[([\s\S]*?)\]/);
  if (alMatch && alMatch[1].trim()) {
    try {
      const fixed = alMatch[1].replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"');
      const arr = JSON.parse("[" + fixed + "]");
      facilitators = [...new Set(arr.map((p) => p.name).filter(Boolean))];
    } catch (e) {
      const nameMatches = alMatch[1].match(/name\s*:\s*['"]([^'"]+)['"]/g);
      if (nameMatches) {
        facilitators = [...new Set(nameMatches.map((m) => {
          const v = m.match(/['"]([^'"]+)['"]\s*$/);
          return v ? v[1] : "";
        }).filter(Boolean))];
      }
    }
  }
  let eduDelivery = "";
  for (const th of tdHeaders) {
    const text = th.textContent.trim();
    if (text.includes("\uBE44\uB300\uBA74")) {
      const nextTd = th.nextElementSibling;
      if (nextTd) {
        const val = nextTd.textContent.trim();
        eduDelivery = val.includes("\uBE44\uB300\uBA74") ? "\uBE44\uB300\uBA74" : val.includes("\uB300\uBA74") ? "\uB300\uBA74" : val;
      }
      break;
    }
  }
  return {
    businessId,
    orderCode,
    projectId,
    company,
    internalManager,
    courseName,
    programName,
    customerId,
    customerName,
    instructors,
    facilitators,
    eduDelivery
  };
}

// src/echo-view.js
function extractEchoviewData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  let eId = "";
  const eidMatch = html.match(/(?:var|let|const)\s+e_id\s*=\s*"(\d+)"/);
  if (eidMatch) eId = eidMatch[1];
  let projectId = "";
  const projLink = doc.querySelector('a[href*="project_view.asp"], button[onclick*="project_view.asp"]');
  if (projLink) {
    const href = projLink.getAttribute("href") || projLink.getAttribute("onclick") || "";
    const pidMatch = href.match(/project_id=(\d+)/i);
    if (pidMatch) projectId = pidMatch[1];
  }
  const titleTds = doc.querySelectorAll("td.title");
  let orderCode = "", echoProjectName = "", company = "", team = "";
  let echoPeriod = "", amRaw = "", clientContactRaw = "";
  for (const td of titleTds) {
    const label = td.textContent.replace(/\s+/g, " ").trim();
    const nextTd = td.nextElementSibling;
    if (!nextTd) continue;
    if (label.includes("\uC218\uC8FC\uCF54\uB4DC")) {
      const codeMatch = nextTd.textContent.match(/\d{4}-\d{3}/);
      if (codeMatch) orderCode = codeMatch[0];
    } else if (label.includes("\uC5D0\uCF54\uD504\uB85C\uC81D\uD2B8\uBA85")) {
      const b = nextTd.querySelector("b");
      echoProjectName = (b ? b.textContent.trim() : nextTd.textContent.trim()).replace(/\s*과정개요.*$/, "").trim();
    } else if (label.includes("\uACE0\uAC1D\uC0AC") && !label.includes("\uB2F4\uB2F9")) {
      const b = nextTd.querySelector("b");
      company = b ? b.textContent.trim() : nextTd.textContent.trim();
    } else if (label.includes("\uC218\uD589\uD300")) {
      const b = nextTd.querySelector("b");
      team = normalizeTeamName(b ? b.textContent.trim() : nextTd.textContent.trim());
    } else if (label.includes("\uC5D0\uCF54 \uC6B4\uC601\uAE30\uAC04") || label.includes("\uC6B4\uC601\uAE30\uAC04")) {
      echoPeriod = nextTd.textContent.trim();
    } else if (label.includes("AM") && label.includes("\uC6B4\uC601")) {
      amRaw = nextTd.textContent.trim();
    } else if (label.includes("\uACE0\uAC1D\uC0AC \uB2F4\uB2F9")) {
      clientContactRaw = nextTd.textContent.trim();
    }
  }
  let am = "", operationManager = "", amTeam = "";
  if (amRaw) {
    const bTags = [];
    for (const td of titleTds) {
      if (td.textContent.includes("AM") && td.textContent.includes("\uC6B4\uC601")) {
        const nextTd = td.nextElementSibling;
        if (nextTd) {
          nextTd.querySelectorAll("b").forEach((b) => bTags.push(b.textContent.trim()));
          const silverSpan = nextTd.querySelector('span[style*="color:silver"], span[style*="color: silver"]');
          if (silverSpan) amTeam = silverSpan.textContent.trim();
        }
        break;
      }
    }
    am = bTags[0] || "";
    operationManager = bTags[1] || "";
    if (!am && amRaw.includes("/")) {
      const parts = amRaw.split("/");
      am = parts[0].trim().split(/\s+/)[0];
      operationManager = parts[1].trim();
    }
  }
  let eduCount = "";
  const contTds = doc.querySelectorAll("td.cont");
  for (const td of contTds) {
    const prev = td.previousElementSibling;
    if (prev && prev.textContent.includes("\uAD50\uC721\uB0B4\uC5ED")) {
      const m = td.textContent.match(/(\d+)건/);
      eduCount = m ? m[1] : td.textContent.trim();
      break;
    }
  }
  let clientContactCount = "", instructorCount = "";
  for (const td of contTds) {
    const prev = td.previousElementSibling;
    if (prev && prev.textContent.includes("\uB2F4\uB2F9\uC778\uC6D0")) {
      const memSpans = td.querySelectorAll("span.memCount");
      if (memSpans.length >= 1) {
        const custMatch = memSpans[0].textContent.match(/(\d+)/);
        if (custMatch) clientContactCount = custMatch[1];
      }
      if (memSpans.length >= 2) {
        instructorCount = memSpans[1].textContent.trim();
      }
      if (!instructorCount) {
        const instrMatch = td.textContent.match(/강사\((\d+)/);
        if (instrMatch) instructorCount = instrMatch[1];
      }
      break;
    }
  }
  return {
    eId,
    projectId,
    orderCode,
    echoProjectName,
    company,
    team,
    echoPeriod,
    am,
    operationManager,
    amTeam,
    clientContactRaw,
    eduCount,
    clientContactCount,
    instructorCount
  };
}

// src/echo-data.js
function extractEchoData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  let projectId = "";
  const pidInput = doc.querySelector('input[name="project_id"]');
  if (pidInput) projectId = pidInput.value;
  if (!projectId) {
    const scriptMatch = html.match(/const\s+project_id\s*=\s*"(\d+)"/);
    if (scriptMatch) projectId = scriptMatch[1];
  }
  let orderCode = "";
  const codeSpans = doc.querySelectorAll(".cont span");
  for (const s of codeSpans) {
    const txt = s.textContent.trim();
    if (/^\d{4}-\d{3}$/.test(txt)) {
      orderCode = txt;
      break;
    }
  }
  let company = "";
  const titleTds = doc.querySelectorAll("td.title");
  for (const td of titleTds) {
    if (td.textContent.includes("\uACE0\uAC1D\uC0AC")) {
      const next = td.nextElementSibling;
      if (next) company = next.textContent.trim().replace(/\s+/g, " ");
      break;
    }
  }
  let educationType = "";
  const valSpans = doc.querySelectorAll("span.val");
  for (const s of valSpans) {
    const t = s.textContent.trim();
    if (t.includes("\uB300\uBA74") || t.includes("\uBE44\uB300\uBA74") || t.includes("\uD63C\uD569")) {
      educationType = t;
      break;
    }
  }
  let totalParticipants = "";
  for (const s of valSpans) {
    const parent = s.parentElement;
    if (parent && parent.textContent.includes("\uCD1D") && parent.textContent.includes("\uBA85")) {
      totalParticipants = s.textContent.trim();
      break;
    }
  }
  let venue = "", venueAddress = "";
  for (const td of titleTds) {
    if (td.textContent.includes("\uC5F0\uC218\uC6D0\uBA85")) {
      const next = td.nextElementSibling;
      if (next) {
        const v = next.querySelector("span.val");
        venue = v ? v.textContent.trim() : next.textContent.trim();
      }
    }
    if (td.textContent.includes("\uC8FC\uC18C")) {
      const next = td.nextElementSibling;
      if (next) {
        const v = next.querySelector("span.val");
        venueAddress = v ? v.textContent.trim() : next.textContent.trim();
      }
    }
  }
  let operationIM = "";
  const imSelect = doc.querySelector('select[name="im_no"]');
  if (imSelect) {
    const selected = imSelect.querySelector("option[selected]");
    if (selected) operationIM = selected.textContent.trim().replace(/\u00a0/g, " ");
  }
  let amName = "", amPhone = "";
  for (const td of titleTds) {
    if (td.textContent.includes("\uB2F4\uB2F9AM")) {
      const next = td.nextElementSibling;
      if (next) {
        const b = next.querySelector("b");
        amName = b ? b.textContent.trim() : "";
        const tel = next.querySelector("span.contactTel");
        amPhone = tel ? tel.textContent.trim() : "";
      }
      break;
    }
  }
  let clientContact = "", clientContactId = "", clientContactPosition = "", clientContactDept = "";
  const contactSelect = doc.querySelector('select[name="im_contactor"]');
  if (contactSelect) {
    const selected = contactSelect.querySelector("option[selected]");
    if (selected) {
      clientContactId = selected.value;
      const raw = selected.textContent.trim().replace(/\u00a0/g, " ");
      const contactMatch = raw.match(/^(.+?)\s+(.*?)\((.*?)\)$/);
      if (contactMatch) {
        clientContact = contactMatch[1];
        clientContactPosition = contactMatch[2];
        clientContactDept = contactMatch[3];
      } else {
        clientContact = raw;
      }
    }
  }
  let clientContactPhone = "", clientContactMobile = "";
  const contactTels = doc.querySelectorAll("span.contactTel");
  const telArr = Array.from(contactTels).map((t) => t.textContent.trim());
  if (telArr.length >= 3) {
    clientContactPhone = telArr[1] || "";
    clientContactMobile = telArr[2] || "";
  }
  let echoStatus = "";
  const alertSpans = doc.querySelectorAll("span.alert");
  for (const s of alertSpans) {
    if (s.textContent.includes("\uC5D0\uCF54 \uC81C\uC678")) {
      echoStatus = "\uC5D0\uCF54 \uC81C\uC678";
      break;
    }
  }
  let sheetState = "";
  const sheetMatch = html.match(/const\s+sheetState\s*=\s*"([^"]+)"/);
  if (sheetMatch) sheetState = sheetMatch[1];
  let surveyUsed = "";
  const surveyChecks = doc.querySelectorAll('input[name="survey"]');
  for (const chk of surveyChecks) {
    if (chk.checked || chk.hasAttribute("checked")) {
      surveyUsed = chk.value;
      break;
    }
  }
  if (!surveyUsed) {
    for (const td of titleTds) {
      if (td.textContent.includes("\uC124\uBB38\uC9C0")) {
        const next = td.nextElementSibling;
        if (next) {
          const v = next.querySelector("span.val");
          const raw = v ? v.textContent.trim() : "";
          if (raw && !raw.includes("\uAE30\uC874 \uC124\uBB38\uBB38\uD56D") && !raw.includes("\uACE0\uAC1D\uC0AC\uC81C\uACF5")) surveyUsed = raw;
        }
        break;
      }
    }
  }
  const schedules = [];
  const allDivs = doc.querySelectorAll("div");
  let sessionIdx = 0;
  allDivs.forEach((div) => {
    if (!(div.hasAttribute("sDate") || div.hasAttribute("sdate"))) return;
    const getAttr = (name) => div.getAttribute(name) || div.getAttribute(name.toLowerCase()) || "";
    const d1 = getAttr("courseDay_d1");
    sessionIdx++;
    schedules.push({
      sessionIndex: sessionIdx,
      startDate: getAttr("sDate"),
      endDate: getAttr("eDate"),
      days: d1,
      nights: getAttr("courseDay_d2"),
      participants: getAttr("courseDay_person") || "0",
      isOvernight: parseInt(d1 || "0") > 0
    });
  });
  return {
    projectId,
    orderCode,
    company,
    educationType,
    totalParticipants,
    venue,
    venueAddress,
    operationIM,
    amName,
    amPhone,
    clientContact,
    clientContactId,
    clientContactPosition,
    clientContactDept,
    clientContactPhone,
    clientContactMobile,
    echoStatus,
    sheetState,
    surveyUsed,
    schedules
  };
}

// src/project.js
function extractProjectDetailData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  let projectId = "";
  const pidInput = doc.querySelector('input[name="PROJECT_ID"]');
  if (pidInput) projectId = pidInput.value;
  if (!projectId) {
    const scriptMatch = html.match(/var\s+project_id\s*=\s*"(\d+)"/);
    if (scriptMatch) projectId = scriptMatch[1];
  }
  let orderCode = "";
  const codeInput = doc.querySelector('input[name="successCode"]');
  if (codeInput) orderCode = codeInput.value;
  if (!orderCode) {
    const tdHeaders = doc.querySelectorAll('td.bris_tb_title, td[bgcolor="#dee8ef"]');
    for (const td of tdHeaders) {
      if (td.textContent.includes("\uC218\uC8FC\uCF54\uB4DC")) {
        const next = td.nextElementSibling;
        if (next) {
          const match = next.textContent.trim().match(/\d{4}-\d{3}/);
          if (match) orderCode = match[0];
        }
        break;
      }
    }
  }
  let projectClosed = "\uBBF8\uC801\uC6A9";
  const allTds = doc.querySelectorAll("td");
  for (let i = 0; i < allTds.length; i++) {
    const td = allTds[i];
    if (td.textContent.includes("\uD504\uB85C\uC81D\uD2B8 \uB9C8\uAC10") && td.querySelector("b")) {
      const next = td.nextElementSibling;
      if (next) {
        const val = next.textContent.trim();
        projectClosed = val || "\uBBF8\uC801\uC6A9";
      }
      break;
    }
  }
  let projectName = "", company = "", am = "", team = "";
  const infoTds = doc.querySelectorAll('td.bris_tb_title, td[bgcolor="#dee8ef"]');
  for (const td of infoTds) {
    const text = td.textContent.trim().replace(/\*/g, "");
    const next = td.nextElementSibling;
    if (!next) continue;
    const val = next.textContent.trim();
    if (text.includes("\uD504\uB85C\uC81D\uD2B8\uBA85")) projectName = val.replace(/\s*과정개요.*$/, "").trim();
    else if (text.includes("\uACE0\uAC1D\uC0AC")) company = val;
    else if (text.includes("AM") && text.includes("Account")) am = val.split(/\s/)[0];
    else if (text.includes("\uC218\uD589\uD300")) team = val;
  }
  let echoActive = false;
  const btnEcho = doc.querySelector("button.btnEcho");
  if (btnEcho) {
    const btnText = btnEcho.textContent.trim();
    if (btnText.includes("\uC5D0\uCF54 \uD604\uD669")) echoActive = "\uD604\uD669";
    else if (btnText.includes("\uC5D0\uCF54 \uB4F1\uB85D")) echoActive = "\uB4F1\uB85D";
    else if (btnText.includes("\uC5D0\uCF54 \uC81C\uC678")) echoActive = "\uC81C\uC678";
  }
  return { projectId, orderCode, projectClosed, projectName, company, am, team, echoActive };
}
function extractProjectBizList(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const sessions = [];
  const allLinks = doc.querySelectorAll('a[href*="go_page"]');
  for (const link of allLinks) {
    const row = link.closest("tr");
    if (!row) continue;
    const tds = row.querySelectorAll("td");
    if (tds.length < 4) continue;
    const sessionIndex = parseInt((tds[0].textContent || "").trim()) || 0;
    const href = link.getAttribute("href") || "";
    const bidMatch = href.match(/go_page\s*\(\s*'[^']*'\s*,\s*'(\d+)'/);
    const businessId = bidMatch ? bidMatch[1] : "";
    const dateText = (link.textContent || "").trim();
    let startDate = "", endDate = "";
    const dateMatch = dateText.match(/(\d{4})\.(\d{2})\.(\d{2})(?:~(\d{2}))?/);
    if (dateMatch) {
      const [, y, m, d, d2] = dateMatch;
      startDate = `${y}-${m}-${d}`;
      endDate = d2 ? `${y}-${m}-${d2.padStart(2, "0")}` : startDate;
    }
    const courseName = (tds[3].textContent || "").trim();
    const revenue = (tds.length > 4 ? tds[4].textContent || "" : "").replace(/[^\d]/g, "");
    if (!businessId && !startDate) continue;
    sessions.push({
      businessId,
      sessionIndex,
      startDate,
      endDate,
      courseName,
      nonFaceToFace: !!(tds[1].textContent || "").trim(),
      revenue
    });
  }
  return { sessions, totalCount: sessions.length };
}

// src/dm.js
function extractDmData(html) {
  const DOMParser = getDOMParser();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  let customerId = "";
  const custInput = doc.querySelector('input[name="CUSTOMER_ID"]');
  if (custInput) customerId = custInput.value;
  let company = "", companyGrade = "";
  const placeLink = doc.querySelector('a[href*="place_view.asp"]');
  if (placeLink) company = placeLink.textContent.trim();
  const tdHeaders = doc.querySelectorAll('td[bgcolor="#DDECB4"]');
  for (const td of tdHeaders) {
    if (td.textContent.includes("\uC0AC\uC5C5\uC7A5\uB4F1\uAE09")) {
      const next = td.nextElementSibling;
      if (next) companyGrade = next.textContent.trim();
    }
  }
  let name = "", position = "";
  for (const td of tdHeaders) {
    if (td.textContent.trim() === "\uC131\uBA85") {
      const next = td.nextElementSibling;
      if (next) {
        const parts = next.textContent.trim().split(/\s+/);
        name = parts[0] || "";
        position = parts[1] || "";
      }
      break;
    }
  }
  let phone = "", mobile = "";
  for (const td of tdHeaders) {
    if (td.textContent.includes("\uC804\uD654") && td.textContent.includes("\uD734\uB300")) {
      const next = td.nextElementSibling;
      if (next) {
        const smsMatch = next.innerHTML.match(/goSMS\s*\(\s*'(\d+)'/);
        const parts = next.innerHTML.split(/<br\s*\/?>/i);
        const phonePart = (parts[0] || "").replace(/<[^>]*>/g, "").trim();
        const mobilePart = (parts[1] || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, "").trim();
        const phoneNums = phonePart.match(/[\d\-]+/g) || [];
        const mobileNums = mobilePart.match(/[\d\-]+/g) || [];
        phone = phoneNums[0] || "";
        mobile = smsMatch ? smsMatch[1] : mobileNums[0] || "";
      }
      break;
    }
  }
  let department = "";
  for (const td of tdHeaders) {
    if (td.textContent.trim() === "\uBD80\uC11C") {
      const next = td.nextElementSibling;
      if (next) department = next.textContent.trim();
      break;
    }
  }
  let email = "";
  const mailLink = doc.querySelector('a[href^="mailto:"]');
  if (mailLink) email = mailLink.textContent.trim();
  let dmSubscription = "";
  for (const td of tdHeaders) {
    if (td.textContent.includes("DM\uC218\uC2E0\uC5EC\uBD80")) {
      const next = td.nextElementSibling;
      if (next) dmSubscription = next.textContent.trim();
      break;
    }
  }
  let customerLevel = "";
  for (const td of tdHeaders) {
    if (td.textContent.includes("\uACE0\uAC1D\uB808\uBCA8")) {
      const next = td.nextElementSibling;
      if (next) customerLevel = next.textContent.trim();
      break;
    }
  }
  return {
    customerId,
    company,
    companyGrade,
    name,
    position,
    department,
    phone: normalizePhone(phone),
    mobile: normalizePhone(mobile),
    email,
    dmSubscription,
    customerLevel
  };
}

// src/index.js
var VERSION = "0.1.0";
export {
  VERSION,
  esc,
  extractDmData,
  extractEchoData,
  extractEchoviewData,
  extractEduDetailData,
  extractIntegratedData,
  extractLabelValues,
  extractProjectBizList,
  extractProjectDetailData,
  genId,
  getDOMParser,
  normalizeDate,
  normalizePhone,
  normalizeTeamName,
  normalizeText,
  parseBrisDate,
  setDOMParser
};
