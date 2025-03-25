const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('.'));

// Armazenar as salas e jogadores
const salas = new Map();

io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id);

    // Quando um jogador procura uma partida
    socket.on('procurarPartida', () => {
        let salaEncontrada = false;

        // Procura uma sala disponível
        for (const [salaId, sala] of salas.entries()) {
            if (sala.jogadores.length === 1) {
                // Encontrou uma sala com apenas um jogador
                sala.jogadores.push({
                    id: socket.id,
                    simbolo: 'O'
                });
                socket.join(salaId);
                salaEncontrada = true;

                // Notifica os jogadores que a partida vai começar
                io.to(salaId).emit('iniciarPartida', {
                    salaId,
                    jogadores: sala.jogadores
                });
                break;
            }
        }

        // Se não encontrou sala, cria uma nova
        if (!salaEncontrada) {
            const salaId = `sala_${Date.now()}`;
            salas.set(salaId, {
                jogadores: [{
                    id: socket.id,
                    simbolo: 'X'
                }],
                tabuleiroPrincipal: Array(9).fill(''),
                miniTabuleiros: Array(9).fill().map(() => Array(9).fill(''))
            });
            socket.join(salaId);
            socket.emit('aguardandoOponente', { salaId });
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
            jogador: jogador.simbolo
        });

        // Se houver vitória em um mini tabuleiro
        if (data.vitoriaMiniTabuleiro) {
            sala.tabuleiroPrincipal[data.boardIndex] = jogador.simbolo;
            io.to(data.salaId).emit('vitoriaMinitabuleiro', {
                boardIndex: data.boardIndex,
                jogador: jogador.simbolo
            });
        }

        // Se houver vitória no jogo
        if (data.vitoriaJogo) {
            io.to(data.salaId).emit('fimDeJogo', {
                vencedor: jogador.simbolo
            });
            salas.delete(data.salaId);
        }
    });

    // Quando um jogador desconecta
    socket.on('disconnect', () => {
        for (const [salaId, sala] of salas.entries()) {
            const index = sala.jogadores.findIndex(j => j.id === socket.id);
            if (index !== -1) {
                io.to(salaId).emit('jogadorDesconectado');
                salas.delete(salaId);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 