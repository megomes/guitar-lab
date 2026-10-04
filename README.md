# Guitar Lab

O [Fretlab](https://github.com/megomes/fretlab-web) e o [CAGED Lab](https://github.com/megomes/caged-lab) num app só, como PWA.

- **Consulta** (o Fretlab): Escalas na forma CAGED com acorde por cima e campo harmônico, Acordes nas cinco formas, e o mapa de Notas.
- **Treino** (o CAGED Lab): a Prática com os seis exercícios da posição em tab e braço, com violão sintetizado em loop, BPM e clique; os drills silenciosos da Reunião; e o Plano de 30 minutos por noite.

Stack: Next.js 16 (App Router) + React 19 + TypeScript, ícones lucide. Sem backend: a página é estática, e as escolhas ficam no `localStorage` do navegador (`guitarlab:settings`).

## As mesmas ideias nas duas metades

- **Uma tônica e uma forma.** Escolher A na forma E em Escalas abre a Prática em A, na posição da forma E, e vice-versa. A forma é a do acorde da tônica (no menor: Em, Dm, Cm, Am, Gm), que é como os dois apps já nomeavam. A caixa da escala e a posição do treino caem no mesmo lugar nas 120 combinações; a única diferença é que a Prática nunca usa casa solta, então as caixas abertas aparecem uma oitava acima.
- **Um braço.** `components/Fretboard.tsx` desenha todas as telas: as esferas de vidro do Fretlab, com as três intensidades do CAGED Lab (acesa, discreta, fantasma), o anel da nota-alvo, as cinco posições lado a lado e a nota que está soando.
- **Uma cor por papel.** Tônica laranja, terça âmbar, quinta azul, o resto branco (`lib/roles.ts`), em escala, acorde, exercício e drill. Os graus são escritos do mesmo jeito em todo lugar: 1, ♭3, 5.
- **Uma grafia.** O nome da nota sai do tom (D♭ maior, C♯ menor), e escala de sete notas usa cada letra uma vez (`lib/spelling.ts`).
- **Pontes.** "Praticar esta posição" leva da escala para o treino; "Ver a escala na consulta" faz o caminho de volta. O botão laranja do topo faz o mesmo de qualquer tela.

## Visual

Design system escuro e quente, copiado do Artivo: quase tudo preto, títulos em serifa (Instrument Serif) com uma palavra em itálico, texto em Inter pequeno e cinza, e um acento só, laranja, em três intensidades: o ponto, o preenchimento e o vidro (o card em destaque, com brilho por dentro e luz em volta). Linhas verticais finas marcam a coluna do conteúdo e o rodapé leva a marca grande, pontilhada. Tokens em `app/globals.css`.

## Teoria

- `lib/fretboard.ts`, `lib/chords.ts`, `lib/harmony.ts` e `lib/notes.ts` vêm do Fretlab (que copia do app nativo). `chordSymbol` ganhou um parâmetro de grafia.
- `lib/practice/caged.ts` e `lib/practice/session.ts` são a teoria do CAGED Lab em TypeScript: posições, formas cheias, arpejos encadeados, linhas na pentatônica, a forma da penta e o arpejo no braço todo. `lib/practice/drills.ts` tem os drills e `lib/practice/plan.ts` tem o plano.
- `lib/practice/audio.ts` é o violão Karplus-Strong do CAGED Lab, com a nota abafada na seguinte.

## PWA

- `app/manifest.ts` é o manifest. Instalado, o app abre em tela cheia e sempre deitado (`orientation: 'landscape'`), sem depender da rotação automática. Os ícones saem de `icons/*.svg` com `node icons/build-icons.mjs`.
- `public/sw.js` é o service worker: a página vem da rede primeiro, com o cache de reserva, e `/_next/static` vem do cache primeiro. Ele só é registrado em produção.

## Celular

- **Sempre deitado.** Instalado, o manifest pede paisagem e o app tenta `screen.orientation.lock('landscape')`. Onde isso não vale (aba do Chrome, app instalado antes da mudança, rotação automática desligada), o CSS gira o app 90° quando a tela está em pé (`(orientation: portrait) and (max-width: 559px)`, a mesma condição de `lib/rotated.ts`), e o braço converte o toque para o eixo girado. O tamanho do app girado vem da janela medida por um script em `app/layout.tsx` antes da primeira pintura (`--win-w`, `--win-h`), e não de `100dvh`: no app instalado do Android, `100dvh` conta a barra de status e o app passava da tela.
- **O layout deitado** (altura até 559px, ou em pé girado): a navegação vira um trilho na lateral, com rótulos, a tela atual em laranja e a ponte (Praticar, Consultar…) no pé. A roda de notas e os diagramas CAGED saem, os controles ficam em uma ou duas linhas e o braço pega a altura que sobra, com as 21 casas sem rolar. Nada da página rola.
- **Braço que rola de lado**: deslizar rola e um toque escolhe a forma. Quando cabe, arrastar leva a forma junto.

## Rodando

```bash
npm install
npm run dev
```

## Deploy

Pensado para a Vercel com a integração Git (cada commit na `main` vira deploy de produção). O projeto ainda não está conectado.
