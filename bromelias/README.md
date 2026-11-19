# Expedição Bromélia

Site de página única sobre a família **Bromeliaceae**, feito como trabalho de Botânica para alunos do ensino médio (a partir de 15 anos). Reúne classificação, anatomia, fotossíntese CAM, ciclo de vida, distribuição, ecologia, importância econômica e social, conservação, fotos autorais do campus da UEFS e um laboratório de jogos.

HTML, CSS e JavaScript puros, sem etapa de build. Pronto para o GitHub Pages.

## Rodar localmente

```bash
python -m http.server
```

Depois abra <http://localhost:8000>. (Abrir o `index.html` direto também funciona, mas o servidor local reproduz melhor o GitHub Pages.)

## Estrutura

```
index.html      estrutura da página (seções estáticas + modelos das interativas)
css/style.css   estilos: tokens (cores, raios, fontes), componentes por seção e estados
js/dados.js     todo o conteúdo das seções interativas (textos, listas, perguntas)
js/app.js       interações, um módulo por seção
img/            fotos (JPG + WebP) e favicon
```

Para corrigir um texto de uma seção interativa (mapa, quiz, jogos, ciclo etc.), edite `js/dados.js`. Os textos das seções estáticas ficam direto no `index.html`.

## Antes de publicar

Substitua os marcadores no `index.html`:
`[SEU NOME]`, `[DISCIPLINA]`, `[INSTITUIÇÃO]`, `[PROFESSOR(A)]`, `[DATA DA OBSERVAÇÃO]`, `[AUTOR DA APOSTILA]`, `[Título da apostila]` (e, na bibliografia, `[AUTORES]`, `[Local]`, `[Editora]`, `[ano]`).

## Créditos

- Textos, ilustrações (anatomia, diagrama floral, cladograma, cena do CAM, ciclo de vida, tipos ecológicos, ícones) e fotos do campus da UEFS: produção própria para este trabalho.
- Fotografias de terceiros: Wikimedia Commons, sob licenças livres. A lista completa, com link para cada arquivo, está na seção **Referências e créditos** do site.
- Mapa da Bahia: base de [svg-maps](https://github.com/VictorCazanave/svg-maps), de Victor Cazanave (CC BY 4.0). Contornos do mapa-múndi: Natural Earth (domínio público).
- Fontes: [Fredoka](https://fonts.google.com/specimen/Fredoka) e [Nunito](https://fonts.google.com/specimen/Nunito), via Google Fonts.
