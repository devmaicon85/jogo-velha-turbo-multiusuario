const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('.'));

// Armazenar as salas e jogadores
const salas = new Map();
const jogadores = new Map(); // Armazena informações dos jogadores

io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id);

    // Quando um jogador se registra com seu nome
    socket.on('registrarJogador', (nome) => {
        jogadores.set(socket.id, {
            id: socket.id,
            nome: nome,
            status: 'online'
        });

        // Envia a lista atualizada de jogadores para todos
        io.emit('listaJogadores', Array.from(jogadores.values()));
    });

    // Quando um jogador procura uma partida
    socket.on('procurarPartida', () => {
        const jogador = jogadores.get(socket.id);
        if (!jogador) return;

        let salaEncontrada = false;

        // Procura uma sala disponível
        for (const [salaId, sala] of salas.entries()) {
            if (sala.jogadores.length === 1) {
                // Encontrou uma sala com apenas um jogador
                const jogadorO = {
                    id: socket.id,
                    nome: jogador.nome,
                    simbolo: 'O'
                };
                sala.jogadores.push(jogadorO);
                socket.join(salaId);
                salaEncontrada = true;

                // Atualiza o status do jogador
                jogador.status = 'jogando';
                jogadores.get(sala.jogadores[0].id).status = 'jogando';

                // Notifica os jogadores que a partida vai começar
                io.to(salaId).emit('iniciarPartida', {
                    salaId,
                    jogadores: sala.jogadores
                });

                // Atualiza a lista de jogadores para todos
                io.emit('listaJogadores', Array.from(jogadores.values()));
                break;
            }
        }

        // Se não encontrou sala, cria uma nova
        if (!salaEncontrada) {
            const salaId = `sala_${Date.now()}`;
            const jogadorX = {
                id: socket.id,
                nome: jogador.nome,
                simbolo: 'X'
            };
            salas.set(salaId, {
                jogadores: [jogadorX],
                tabuleiroPrincipal: Array(9).fill(''),
                miniTabuleiros: Array(9).fill().map(() => Array(9).fill(''))
            });
            socket.join(salaId);
            socket.emit('aguardandoOponente', { salaId });

            // Atualiza o status do jogador
            jogador.status = 'aguardando';
            io.emit('listaJogadores', Array.from(jogadores.values()));
        }
    });

    // Quando um jogador faz uma jogada
    socket.on('fazerJogada', (data) => {
        const sala = salas.get(data.salaId);
        if (!sala) return;

        const jogador = sala.jogadores.find(j => j.id === socket.id);
        if (!jogador) return;

        // Atualiza o estado do jogo na sala
        sala.miniTabuleiros[data.boardIndex][data.cellIndex] = jogador.simbolo;
        
        // Envia a jogada para todos na sala
        io.to(data.salaId).emit('jogadaFeita', {
            boardIndex: data.boardIndex,
            cellIndex: data.cellIndex,
            jogador: jogador.simbolo,
            nomeJogador: jogador.nome
        });

        // Se houver vitória em um mini tabuleiro
        if (data.vitoriaMiniTabuleiro) {
            sala.tabuleiroPrincipal[data.boardIndex] = jogador.simbolo;
            io.to(data.salaId).emit('vitoriaMinitabuleiro', {
                boardIndex: data.boardIndex,
                jogador: jogador.simbolo,
                nomeJogador: jogador.nome
            });
        }

        // Se houver vitória no jogo
        if (data.vitoriaJogo) {
            io.to(data.salaId).emit('fimDeJogo', {
                vencedor: jogador.simbolo,
                nomeVencedor: jogador.nome
            });

            // Atualiza o status dos jogadores
            sala.jogadores.forEach(j => {
                const jogador = jogadores.get(j.id);
                if (jogador) {
                    jogador.status = 'online';
                }
            });

            salas.delete(data.salaId);
            io.emit('listaJogadores', Array.from(jogadores.values()));
        }
    });

    // Quando uma mensagem é enviada no chat
    socket.on('mensagemChat', (mensagem) => {
        const jogador = jogadores.get(socket.id);
        if (!jogador) return;

        io.emit('mensagemChat', {
            jogador: jogador.nome,
            mensagem: mensagem,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    // Quando um jogador desconecta
    socket.on('disconnect', () => {
        const jogador = jogadores.get(socket.id);
        if (jogador) {
            // Remove o jogador da lista
            jogadores.delete(socket.id);
            io.emit('listaJogadores', Array.from(jogadores.values()));
        }

        // Verifica se o jogador estava em alguma sala
        for (const [salaId, sala] of salas.entries()) {
            const index = sala.jogadores.findIndex(j => j.id === socket.id);
            if (index !== -1) {
                io.to(salaId).emit('jogadorDesconectado', {
                    nomeJogador: sala.jogadores[index].nome
                });
                
                // Atualiza o status do outro jogador
                const outroJogador = sala.jogadores[1 - index];
                if (outroJogador) {
                    const jogadorInfo = jogadores.get(outroJogador.id);
                    if (jogadorInfo) {
                        jogadorInfo.status = 'online';
                    }
                }

                salas.delete(salaId);
                io.emit('listaJogadores', Array.from(jogadores.values()));
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 