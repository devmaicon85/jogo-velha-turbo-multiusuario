class UltimateJogoDaVelha {
    constructor() {
        this.tabuleiroPrincipal = Array(9).fill('');
        this.miniTabuleiros = Array(9).fill().map(() => Array(9).fill(''));
        this.jogadorAtual = 'X';
        this.jogoAtivo = false;
        this.simboloJogador = null;
        this.salaId = null;
        this.nomeJogador = null;
        
        this.combinacoesVitoria = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Linhas
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colunas
            [0, 4, 8], [2, 4, 6]             // Diagonais
        ];

        // Inicializa o Socket.IO
        this.socket = io();
        this.inicializarSocketEvents();
        this.inicializarTabuleiro();
        this.inicializarEventos();
        this.mostrarModalNome();
    }

    mostrarModalNome() {
        const modal = document.getElementById('modal-nome');
        const form = document.getElementById('form-nome');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nome = document.getElementById('nome').value.trim();
            if (nome) {
                this.nomeJogador = nome;
                this.socket.emit('registrarJogador', nome);
                modal.style.display = 'none';
                this.atualizarStatus('Clique em "Procurar Partida" para começar');
            }
        });
    }

    inicializarSocketEvents() {
        // Atualização da lista de jogadores
        this.socket.on('listaJogadores', (jogadores) => {
            this.atualizarListaJogadores(jogadores);
        });

        // Mensagens do chat
        this.socket.on('mensagemChat', (data) => {
            this.adicionarMensagemChat(data);
        });

        // Quando encontra um oponente
        this.socket.on('iniciarPartida', (data) => {
            this.salaId = data.salaId;
            const jogador = data.jogadores.find(j => j.id === this.socket.id);
            this.simboloJogador = jogador.simbolo;
            this.jogoAtivo = true;
            this.jogadorAtual = 'X';

            // Atualiza os nomes dos jogadores na legenda
            const jogadorX = data.jogadores.find(j => j.simbolo === 'X');
            const jogadorO = data.jogadores.find(j => j.simbolo === 'O');
            document.getElementById('jogador-x').textContent = `${jogadorX.nome} (X)`;
            document.getElementById('jogador-o').textContent = `${jogadorO.nome} (O)`;

            this.atualizarStatusConexao(`Partida iniciada! Você é o jogador ${this.simboloJogador}`);
            this.atualizarStatus();
        });

        // Quando está aguardando oponente
        this.socket.on('aguardandoOponente', (data) => {
            this.salaId = data.salaId;
            this.simboloJogador = 'X';
            this.atualizarStatusConexao('Aguardando oponente...');
        });

        // Quando recebe uma jogada do oponente
        this.socket.on('jogadaFeita', (data) => {
            if (data.jogador !== this.simboloJogador) {
                this.realizarJogadaOponente(data.boardIndex, data.cellIndex, data.jogador);
            }
        });

        // Quando um mini tabuleiro é vencido
        this.socket.on('vitoriaMinitabuleiro', (data) => {
            this.tabuleiroPrincipal[data.boardIndex] = data.jogador;
            const miniBoard = document.querySelectorAll('.mini-board')[data.boardIndex];
            const isX = data.jogador === 'X';
            
            miniBoard.classList.remove('border-2', 'border-gray-200');
            miniBoard.classList.add(isX ? 'bg-blue-200' : 'bg-red-200');
            
            const cells = miniBoard.querySelectorAll('.cell');
            cells.forEach(cell => {
                cell.classList.remove('border', 'border-gray-200', 'hover:bg-white');
                if (cell.textContent === '') {
                    cell.classList.add('bg-gray-100');
                    cell.disabled = true;
                }
            });

            // Adiciona mensagem no chat sobre a vitória do mini tabuleiro
            this.adicionarMensagemSistema(`${data.nomeJogador} venceu o tabuleiro ${data.boardIndex + 1}!`);
        });

        // Quando o jogo termina
        this.socket.on('fimDeJogo', (data) => {
            this.jogoAtivo = false;
            const isX = data.vencedor === 'X';
            const statusElement = document.getElementById('status');
            statusElement.innerHTML = `${data.nomeVencedor} (${data.vencedor}) venceu o jogo!`;
            this.adicionarMensagemSistema(`${data.nomeVencedor} venceu o jogo!`);
        });

        // Quando o oponente desconecta
        this.socket.on('jogadorDesconectado', (data) => {
            this.jogoAtivo = false;
            this.atualizarStatusConexao(`${data.nomeJogador} desconectou. Procure uma nova partida.`);
            this.adicionarMensagemSistema(`${data.nomeJogador} desconectou do jogo.`);
            this.reiniciarJogo();
        });
    }

    atualizarListaJogadores(jogadores) {
        const lista = document.getElementById('lista-jogadores');
        lista.innerHTML = '';
        
        jogadores.forEach(jogador => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between p-2 rounded';
            
            // Define a cor de fundo baseada no status
            switch(jogador.status) {
                case 'jogando':
                    li.classList.add('bg-green-100');
                    break;
                case 'aguardando':
                    li.classList.add('bg-yellow-100');
                    break;
                default:
                    li.classList.add('bg-gray-100');
            }

            li.innerHTML = `
                <span>${jogador.nome}</span>
                <span class="text-sm text-gray-600">${jogador.status}</span>
            `;
            lista.appendChild(li);
        });
    }

    adicionarMensagemChat(data) {
        const mensagens = document.getElementById('mensagens');
        const div = document.createElement('div');
        div.className = 'p-2 rounded';
        
        if (data.jogador === this.nomeJogador) {
            div.classList.add('bg-blue-100', 'text-right');
        } else {
            div.classList.add('bg-gray-100');
        }

        div.innerHTML = `
            <span class="font-bold">${data.jogador}</span>
            <span class="text-xs text-gray-500">${data.timestamp}</span>
            <p>${data.mensagem}</p>
        `;

        mensagens.appendChild(div);
        mensagens.scrollTop = mensagens.scrollHeight;
    }

    adicionarMensagemSistema(mensagem) {
        const mensagens = document.getElementById('mensagens');
        const div = document.createElement('div');
        div.className = 'p-2 text-center text-sm text-gray-500';
        div.textContent = mensagem;
        mensagens.appendChild(div);
        mensagens.scrollTop = mensagens.scrollHeight;
    }

    inicializarTabuleiro() {
        const miniBoards = document.querySelectorAll('.mini-board');
        miniBoards.forEach((board, boardIndex) => {
            const grid = board.querySelector('.grid');
            for (let i = 0; i < 9; i++) {
                const cell = document.createElement('button');
                cell.className = 'cell w-full h-12 bg-gray-50 hover:bg-white text-3xl font-bold rounded transition-colors border border-gray-200';
                cell.dataset.board = boardIndex;
                cell.dataset.cell = i;
                grid.appendChild(cell);
            }
        });
    }

    inicializarEventos() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const boardIndex = parseInt(cell.dataset.board);
                const cellIndex = parseInt(cell.dataset.cell);
                this.fazerJogada(boardIndex, cellIndex);
            });
        });

        document.getElementById('procurar-partida').addEventListener('click', () => {
            this.socket.emit('procurarPartida');
            this.atualizarStatusConexao('Procurando partida...');
        });

        document.getElementById('form-chat').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('mensagem');
            const mensagem = input.value.trim();
            if (mensagem) {
                this.socket.emit('mensagemChat', mensagem);
                input.value = '';
            }
        });

        document.getElementById('reset').addEventListener('click', () => this.reiniciarJogo());
    }

    fazerJogada(boardIndex, cellIndex) {
        if (!this.jogoAtivo || 
            this.jogadorAtual !== this.simboloJogador ||
            this.miniTabuleiros[boardIndex][cellIndex] !== '' ||
            this.tabuleiroPrincipal[boardIndex] !== '') {
            return;
        }

        this.miniTabuleiros[boardIndex][cellIndex] = this.simboloJogador;
        const cell = document.querySelector(`[data-board="${boardIndex}"][data-cell="${cellIndex}"]`);
        cell.textContent = this.simboloJogador;
        cell.classList.add(this.simboloJogador === 'X' ? 'text-blue-600' : 'text-red-600');

        const vitoriaMiniTabuleiro = this.verificarVitoriaMiniTabuleiro(boardIndex);
        const vitoriaJogo = vitoriaMiniTabuleiro && this.verificarVitoriaPrincipal();

        this.socket.emit('fazerJogada', {
            salaId: this.salaId,
            boardIndex,
            cellIndex,
            vitoriaMiniTabuleiro,
            vitoriaJogo
        });

        this.jogadorAtual = this.jogadorAtual === 'X' ? 'O' : 'X';
        this.atualizarStatus();
    }

    realizarJogadaOponente(boardIndex, cellIndex, simbolo) {
        this.miniTabuleiros[boardIndex][cellIndex] = simbolo;
        const cell = document.querySelector(`[data-board="${boardIndex}"][data-cell="${cellIndex}"]`);
        cell.textContent = simbolo;
        cell.classList.add(simbolo === 'X' ? 'text-blue-600' : 'text-red-600');
        
        this.jogadorAtual = this.jogadorAtual === 'X' ? 'O' : 'X';
        this.atualizarStatus();
    }

    verificarVitoriaMiniTabuleiro(boardIndex) {
        return this.combinacoesVitoria.some(combinacao => {
            return combinacao.every(index => {
                return this.miniTabuleiros[boardIndex][index] === this.jogadorAtual;
            });
        });
    }

    verificarVitoriaPrincipal() {
        return this.combinacoesVitoria.some(combinacao => {
            return combinacao.every(index => {
                return this.tabuleiroPrincipal[index] === this.jogadorAtual;
            });
        });
    }

    atualizarStatus() {
        const statusElement = document.getElementById('status');
        if (this.jogoAtivo) {
            const suaVez = this.jogadorAtual === this.simboloJogador;
            statusElement.innerHTML = suaVez ? 
                `Sua vez!` :
                `Aguardando jogada do oponente...`;
        }
    }

    atualizarStatusConexao(mensagem) {
        const statusElement = document.getElementById('status-conexao');
        statusElement.textContent = mensagem;
    }

    reiniciarJogo() {
        this.tabuleiroPrincipal = Array(9).fill('');
        this.miniTabuleiros = Array(9).fill().map(() => Array(9).fill(''));
        this.jogadorAtual = 'X';
        this.jogoAtivo = false;

        document.querySelectorAll('.mini-board').forEach(board => {
            board.classList.remove('bg-blue-200', 'bg-red-200', 'bg-gray-200');
            board.classList.add('border-2', 'border-gray-200');
            
            const cells = board.querySelectorAll('.cell');
            cells.forEach(cell => {
                cell.textContent = '';
                cell.disabled = false;
                cell.classList.remove('text-blue-600', 'text-red-600', 'bg-gray-100');
                cell.classList.add('bg-gray-50', 'hover:bg-white', 'border', 'border-gray-200');
            });
        });

        // Reseta os nomes dos jogadores na legenda
        document.getElementById('jogador-x').textContent = 'Jogador X';
        document.getElementById('jogador-o').textContent = 'Jogador O';

        this.atualizarStatus('Clique em "Procurar Partida" para começar');
        this.adicionarMensagemSistema('O jogo foi reiniciado.');
    }
}

// Iniciar o jogo quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new UltimateJogoDaVelha();
}); 