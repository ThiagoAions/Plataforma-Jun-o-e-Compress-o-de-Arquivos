# AIONS Docs

Plataforma interna de manipulação, organização e compressão de arquivos PDF e Imagens.

> 🔒 **100% Client-Side** — nenhum arquivo é enviado a servidores externos. Conformidade total com a LGPD.

---

## Stack

- **React 18** + **TypeScript**
- **Vite** (build tool)
- **pdf-lib** (manipulação de PDF no browser)
- **lucide-react** (ícones)
- Fontes: **Syne** (display) + **JetBrains Mono** (mono)

---

## Instalação e uso

### Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn

### Passos

```bash
# 1. Instalar dependências
npm install

# 2. Rodar em modo desenvolvimento
npm run dev

# 3. Acessar no browser
# http://localhost:5173
```

### Build para produção

```bash
npm run build
npm run preview
```

---

## Estrutura do projeto

```
aions-docs/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ui.tsx           # Componentes reutilizáveis (DropZone, FileList, Btn, Alert...)
│   │   ├── Header.tsx       # Cabeçalho da aplicação
│   │   ├── Sidebar.tsx      # Navegação lateral
│   │   ├── Dashboard.tsx    # Tela inicial com cards das ferramentas
│   │   ├── MergeTool.tsx    # Ferramenta: Juntar PDFs
│   │   ├── SplitTool.tsx    # Ferramenta: Dividir PDF
│   │   ├── CompressTool.tsx # Ferramenta: Comprimir PDF/Imagem
│   │   └── ConvertTool.tsx  # Ferramenta: Imagens → PDF
│   ├── hooks/
│   │   ├── useFileManager.ts  # Estado e operações de arquivos
│   │   └── useProcessing.ts   # Estado de progresso/processamento
│   ├── utils/
│   │   └── pdf.ts           # Lógica de PDF (merge, split, compress, convert)
│   ├── types/
│   │   └── index.ts         # Tipos TypeScript globais
│   ├── App.tsx              # Componente raiz + roteamento
│   ├── main.tsx             # Entry point
│   └── index.css            # Tema escuro + variáveis CSS
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Ferramentas disponíveis

| Ferramenta       | Descrição                                              | Status     |
|------------------|--------------------------------------------------------|------------|
| Juntar PDF       | Merge de múltiplos PDFs com reordenação drag-and-drop  | ✅ Ativo   |
| Dividir PDF      | Extração por intervalo de páginas ou página por página | ✅ Ativo   |
| Comprimir        | Redução de peso para PDF e imagens (JPG/PNG)           | ✅ Ativo   |
| Converter        | Imagens JPG/PNG → PDF                                  | ✅ Ativo   |
| Organizar Páginas| Miniaturas, rotação, exclusão de páginas               | 🔜 Em breve|

---

## Tema / Design

O tema escuro usa variáveis CSS definidas em `src/index.css`:

```css
--bg-primary: #0d1117       /* Fundo principal */
--bg-secondary: #161b22     /* Superfícies */
--accent-cyan: #00c8ff      /* Cor de destaque principal */
--accent-magenta: #c850c0   /* Destaque secundário */
--accent-blue: #1a6fd4      /* Botões primários */
```

Para customizar cores, edite as variáveis em `src/index.css`.

---

## Segurança e LGPD

- ✅ Zero upload para servidores externos
- ✅ Processamento via Web APIs nativas (Canvas, FileReader, ArrayBuffer)
- ✅ pdf-lib opera inteiramente no browser
- ✅ Sem cookies, sem telemetria, sem dependências externas de rede em runtime
