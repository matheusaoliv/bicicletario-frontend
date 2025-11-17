# 🚲 Bicicletário Municipal de Japeri - Frontend

Interface web do sistema de controle e gerenciamento de bicicletas para o município de Japeri.

## 🎉 **SISTEMA INAUGURADO - NOVEMBRO 2025**

✅ **Interface moderna e responsiva**  
✅ **Google Login integrado**  
✅ **Dashboard com estatísticas em tempo real**  
✅ **Sistema completo de controle de acesso**  
✅ **28.177 registros no banco de dados**  

## 🌐 **Acesso ao Sistema**

**🔗 URL de Produção:** https://matheusaoliv.github.io/bicicletario-frontend/BicicletarioMunicipaldeJaperi/

### **Páginas Principais:**
- **Login:** `/login.html`
- **Dashboard:** `/area-funcionario.html` 
- **Cadastro de Funcionários:** `/cadastro-funcionario.html`
- **Cadastro de Bicicletas:** `/adicionar-bicicleta.html`
- **Painel Admin:** `/admin.html`

## 🛠️ **Tecnologias**

- **HTML5** - Estrutura semântica
- **CSS3** - Estilos modernos e responsivos
- **JavaScript ES6+** - Funcionalidades interativas
- **Firebase Auth** - Autenticação com Google
- **Firebase Firestore** - Banco de dados em tempo real
- **Chart.js** - Gráficos e estatísticas
- **GitHub Pages** - Hospedagem estática

## 🎯 **Funcionalidades**

### 🔐 **Autenticação**
- Login com email/senha
- Login com Google OAuth
- Controle de sessão
- Logout seguro

### 📊 **Dashboard**
- Estatísticas em tempo real
- Gráficos interativos
- Feed de atividades
- Alertas de inatividade

### 🚲 **Gestão de Bicicletas**
- Cadastro de proprietários
- Registro de bicicletas
- Controle de entrada/saída
- Busca avançada

### 📱 **Interface**
- Design responsivo
- Tema claro/escuro
- Navegação intuitiva
- Feedback visual

## 🏗️ **Estrutura do Projeto**

```
BicicletarioMunicipaldeJaperi/
├── 📄 index.html                    # Página inicial
├── 📄 login.html                    # Login de funcionários
├── 📄 area-funcionario.html         # Dashboard principal
├── 📄 cadastro-funcionario.html     # Cadastro de funcionários
├── 📄 adicionar-bicicleta.html      # Cadastro de bicicletas
├── 📄 admin.html                    # Painel administrativo
├── 📁 css/                          # Estilos CSS
│   ├── area-funcionario.css
│   ├── admin-login.css
│   └── style-moderno.css
├── 📁 js/                           # Scripts JavaScript
│   ├── api-client.js               # Cliente da API
│   ├── app-moderno.js              # Funcionalidades principais
│   ├── admin-login.js              # Login administrativo
│   └── catalogo-bikes-ui.js        # Interface do catálogo
├── 📁 imagens/                      # Recursos visuais
│   ├── logobicicletario.png
│   └── favicon.ico
└── 📁 data/                         # Dados estáticos
    └── catalogo-bikes.json         # Catálogo de bicicletas
```

## 🚀 **Como Usar Localmente**

1. **Clone o repositório:**
```bash
git clone https://github.com/matheusaoliv/bicicletario-frontend.git
cd bicicletario-frontend
```

2. **Sirva os arquivos localmente:**
```bash
# Opção 1: Python
python -m http.server 8000

# Opção 2: Node.js
npx http-server BicicletarioMunicipaldeJaperi -p 8000

# Opção 3: Live Server (VS Code)
# Instale a extensão Live Server e clique com o botão direito em login.html
```

3. **Acesse no navegador:**
```
http://localhost:8000/login.html
```

## 🔧 **Configuração**

O frontend está configurado para usar a API em produção:
- **API Base URL:** `https://api-daja3h3cva-rj.a.run.app`
- **Firebase Project:** `bicicletario-japeri-v3`
- **Autenticação:** Firebase Auth + Google OAuth

## 📊 **Dados do Sistema**

| Coleção | Registros | Descrição |
|---------|-----------|-----------|
| funcionarios | 16 | Funcionários cadastrados |
| proprietarios | 1.262 | Proprietários de bicicletas |
| bicicletas | 1.263 | Bicicletas registradas |
| controleacesso | 25.566 | Histórico de entradas/saídas |
| alert_actions | 74 | Ações de alertas |

## 🎨 **Design System**

### **Cores Principais:**
- **Primária:** #268378 (Verde)
- **Secundária:** #34495e (Azul escuro)
- **Sucesso:** #27ae60 (Verde claro)
- **Alerta:** #f39c12 (Laranja)
- **Erro:** #e74c3c (Vermelho)

### **Tipografia:**
- **Fonte:** Roboto (Google Fonts)
- **Tamanhos:** 14px, 16px, 18px, 24px, 32px

## 📱 **Responsividade**

O sistema é totalmente responsivo e funciona em:
- 💻 **Desktop** (1200px+)
- 📱 **Tablet** (768px - 1199px)
- 📱 **Mobile** (320px - 767px)

## 🆘 **Suporte**

Para dúvidas ou problemas:
1. Verifique o console do navegador (F12)
2. Teste em modo anônimo/privado
3. Limpe o cache do navegador
4. Abra uma issue no GitHub

## 📄 **Licença**

Este projeto é de propriedade da **Prefeitura Municipal de Japeri**.

---

**🎉 Sistema inaugurado em Novembro de 2025**  
**🚲 Bicicletário Municipal de Japeri - Mobilidade Sustentável**  
**🌐 Desenvolvido com ❤️ para a comunidade de Japeri**
