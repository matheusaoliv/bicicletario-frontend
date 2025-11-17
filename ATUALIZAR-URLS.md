# 🔧 SCRIPT PARA ATUALIZAR URLs DA API

## ⚠️ ATENÇÃO: Execute ANTES de fazer upload para GitHub Pages

Você precisa atualizar a URL da API em 3 arquivos do frontend para que conecte com seu backend no Render.

---

## 📝 ARQUIVOS PARA EDITAR

### 1. Arquivo: `js/api-client.js`

**Procure esta linha (aproximadamente linha 7):**
```javascript
const API_BASE_URL = global.API_BASE_URL || 'https://bicicletario-backend.onrender.com/api';
```

**Substitua por:**
```javascript
const API_BASE_URL = global.API_BASE_URL || 'https://SEU-APP-NOME.onrender.com/api';
```

### 2. Arquivo: `js/detalhe-registro.js`

**Procure esta linha (aproximadamente linha 5):**
```javascript
const API_BASE_URL = window.API_BASE_URL || 'https://bicicletario-backend.onrender.com';
```

**Substitua por:**
```javascript
const API_BASE_URL = window.API_BASE_URL || 'https://SEU-APP-NOME.onrender.com';
```

### 3. Arquivo: `admin.js`

**Procure esta linha (aproximadamente linha 5):**
```javascript
const API_BASE_URL = 'https://bicicletario-backend.onrender.com';
```

**Substitua por:**
```javascript
const API_BASE_URL = 'https://SEU-APP-NOME.onrender.com';
```

---

## 🎯 COMO DESCOBRIR SUA URL DO RENDER

1. Acesse [render.com](https://render.com)
2. Vá no seu web service do backend
3. No topo da página aparece: `https://nome-do-seu-app.onrender.com`
4. **Copie essa URL completa**

---

## ✅ EXEMPLO PRÁTICO

Se sua URL no Render for: `https://bicicletario-japeri.onrender.com`

**Então você deve colocar:**

**No api-client.js:**
```javascript
const API_BASE_URL = global.API_BASE_URL || 'https://bicicletario-japeri.onrender.com/api';
```

**No detalhe-registro.js:**
```javascript
const API_BASE_URL = window.API_BASE_URL || 'https://bicicletario-japeri.onrender.com';
```

**No admin.js:**
```javascript
const API_BASE_URL = 'https://bicicletario-japeri.onrender.com';
```

---

## 🚨 IMPORTANTE

- **NÃO** adicione `/api` no final das URLs do `detalhe-registro.js` e `admin.js`
- **SIM** adicione `/api` apenas no `api-client.js`
- Salve todos os arquivos antes de fazer upload
- Teste localmente se possível antes do deploy

---

## 🔄 DEPOIS DE EDITAR

1. Salve todos os 3 arquivos
2. Faça upload para o GitHub
3. Aguarde 2-5 minutos para GitHub Pages atualizar
4. Teste o sistema
