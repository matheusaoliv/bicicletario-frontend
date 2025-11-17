# 🚲 Bicicletário Municipal de Japeri

Sistema completo de controle e gerenciamento de bicicletas para o município de Japeri.

## 🎉 **NOVA VERSÃO - NOVEMBRO 2025**

✅ **Migração completa para Firebase**  
✅ **28.177 registros migrados com sucesso**  
✅ **Google Login implementado**  
✅ **Dashboard modernizado**  
✅ **Interface responsiva**  
✅ **Pronto para inauguração!**

## 🚀 **Acesso ao Sistema**

**🌐 URL de Produção:** [https://seu-usuario.github.io/repositorio](https://seu-usuario.github.io/repositorio)

**👨‍💼 Login de Funcionários:**
- Acesse: `/login.html`
- Use suas credenciais ou faça login com Google

**📊 Dashboard:** `/area-funcionario.html`

## 🛠️ **Tecnologias**

- **Frontend:** HTML5, CSS3, JavaScript ES6+
- **Backend:** Firebase Cloud Functions (Node.js)
- **Banco de dados:** Firebase Firestore
- **Autenticação:** Firebase Auth + Google OAuth
- **Storage:** Firebase Storage
- **Hospedagem:** GitHub Pages (frontend), Firebase (backend)

## 📊 **Dados Migrados**

| Coleção | Registros | Status |
|---------|-----------|--------|
| funcionarios | 16 | ✅ |
| proprietarios | 1.262 | ✅ |
| bicicletas | 1.263 | ✅ |
| controleacesso | 25.566 | ✅ |
| alert_actions | 74 | ✅ |
| **TOTAL** | **28.177** | ✅ |

## 🎯 **Principais Funcionalidades**

- 🔐 **Login seguro** com Google OAuth
- 📊 **Dashboard** com estatísticas em tempo real
- 🚲 **Controle de entrada/saída** de bicicletas
- 👥 **Cadastro** de proprietários e bicicletas
- 🚨 **Sistema de alertas** e notificações
- 🔍 **Busca avançada** e filtros
- 📈 **Relatórios** e exportação de dados
- 📱 **Interface responsiva** para mobile

## 🏗️ **Estrutura do Projeto**

```
📁 BicicletarioMunicipaldeJaperi/     # Frontend (GitHub Pages)
├── 📄 login.html                     # Login de funcionários
├── 📄 area-funcionario.html          # Dashboard principal
├── 📄 cadastro-funcionario.html      # Cadastro de funcionários
├── 📄 adicionar-bicicleta.html       # Cadastro de bicicletas
├── 📁 js/                            # Scripts JavaScript
├── 📁 css/                           # Estilos CSS
└── 📁 imagens/                       # Recursos visuais

📁 functions/                         # Backend (Firebase Functions)
├── 📄 index.js                       # API principal
├── 📁 services/                      # Serviços auxiliares
└── 📄 package.json                   # Dependências

📁 banco de dados/                    # Scripts de migração
├── 📄 migrar-supabase-firestore-v2.js
├── 📄 validar-migracao.js
└── 📄 GUIA-MIGRACAO.md
```

## 🚀 **Como Executar Localmente**

### Pré-requisitos
- Node.js 18+
- Conta Firebase
- Git

### Passos

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/repositorio.git
cd repositorio
```

2. **Configure o Firebase**
```bash
npm install -g firebase-tools
firebase login
firebase use bicicletario-japeri-v3
```

3. **Execute localmente**
```bash
npm install
npm run dev:all
```

4. **Acesse o sistema**
- Frontend: http://localhost:3000
- API: http://localhost:5050/api

## 📋 **Configuração de Produção**

### GitHub Pages (Frontend)
1. Vá em **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **docs** ou **BicicletarioMunicipaldeJaperi**
4. Save

### Firebase (Backend)
```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## 🔧 **Variáveis de Ambiente**

Crie `.env` na raiz:
```env
FIREBASE_PROJECT_ID=bicicletario-japeri-v3
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
```

## 📚 **Documentação**

- 📖 [Guia de Deploy](README-DEPLOY.md)
- 🏠 [Execução Local](README-LOCAL.md)
- 🔄 [Migração de Dados](banco%20de%20dados/GUIA-MIGRACAO.md)
- ✅ [Checklist de Deploy](CHECKLIST-DEPLOY.md)

## 🆘 **Suporte**

Para dúvidas ou problemas:
1. Verifique a [documentação](README-DEPLOY.md)
2. Consulte os logs no Firebase Console
3. Abra uma issue no GitHub

## 📄 **Licença**

Este projeto é de propriedade da **Prefeitura Municipal de Japeri**.

---

**🎉 Sistema inaugurado em Novembro de 2025**  
**🚲 Bicicletário Municipal de Japeri - Mobilidade Sustentável**
