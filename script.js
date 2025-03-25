class UltimateJogoDaVelha {
    constructor() {
        this.tabuleiroPrincipal = Array(9).fill('');
        this.miniTabuleiros = Array(9).fill().map(() => Array(9).fill(''));
        this.jogadorAtual = 'X';
        this.jogoAtivo = false;
        this.simboloJogador = null;
        this.salaId = null;
        
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
        this.atualizarStatus('Clique em "Procurar Partida" para começar');
    }

    inicializarSocketEvents() {
        // Quando encontra um oponente
        this.socket.on('iniciarPartida', (data) => {
            this.salaId = data.salaId;
            const jogador = data.jogadores.find(j => j.id === this.socket.id);
            this.simboloJogador = jogador.simbolo;
            this.jogoAtivo = true;
            this.jogadorAtual = 'X';
            this.atualizarStatusConexao('Partida iniciada! Você é o jogador ' + this.simboloJogador);
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
        });

        // Quando o jogo termina
        this.socket.on('fimDeJogo', (data) => {
            this.jogoAtivo = false;
            const isX = data.vencedor === 'X';
            const statusElement = document.getElementById('status');
            statusElement.innerHTML = `<span class="${isX ? 'text-blue-600' : 'text-red-600'} font-bold">Jogador ${data.vencedor}</span> venceu o jogo!`;
        });

        // Quando o oponente desconecta
        this.socket.on('jogadorDesconectado', () => {
            this.jogoAtivo = false;
            this.atualizarStatusConexao('Oponente desconectou. Procure uma nova partida.');
            this.reiniciarJogo();
        });
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

        document.getElementById('reset').addEventListener('click', () => this.reiniciarJogo());
    }

    fazerJogada(boardIndex, cellIndex) {
        // Verifica se pode jogar
        if (!this.jogoAtivo || 
            this.jogadorAtual !== this.simboloJogador ||
            this.miniTabuleiros[boardIndex][cellIndex] !== '' ||
            this.tabuleiroPrincipal[boardIndex] !== '') {
            return;
        }

        // Faz a jogada no mini tabuleiro
        this.miniTabuleiros[boardIndex][cellIndex] = this.simboloJogador;
        const cell = document.querySelector(`[data-board="${boardIndex}"][data-cell="${cellIndex}"]`);
        cell.textContent = this.simboloJogador;
        cell.classList.add(this.simboloJogador === 'X' ? 'text-blue-600' : 'text-red-600');

        // Verifica vitória no mini tabuleiro
        const vitoriaMiniTabuleiro = this.verificarVitoriaMiniTabuleiro(boardIndex);
        const vitoriaJogo = vitoriaMiniTabuleiro && this.verificarVitoriaPrincipal();

        // Envia a jogada para o servidor
        this.socket.emit('fazerJogada', {
            salaId: this.salaId,
            boardIndex,
            cellIndex,
            vitoriaMiniTabuleiro,
            vitoriaJogo
        });

        // Troca o jogador
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

    verificarEmpateMiniTabuleiro(boardIndex) {
        return this.miniTabuleiros[boardIndex].every(cell => cell !== '');
    }

    atualizarStatus() {
        const statusElement = document.getElementById('status');
        if (this.jogoAtivo) {
            const suaVez = this.jogadorAtual === this.simboloJogador;
            statusElement.innerHTML = suaVez ? 
                `Sua vez! (${this.simboloJogador})` :
                `Vez do oponente (${this.jogadorAtual})`;
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

        // Restaura o estado visual inicial
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

        this.atualizarStatus('Clique em "Procurar Partida" para começar');
    }
}

// Iniciar o jogo quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new UltimateJogoDaVelha();
}); 