import { Card, Button, Badge } from 'react-bootstrap';

const StakeCard = ({ stake, onUnstake, onClaim }) => {
    const isCompleted = new Date() > new Date(stake.endTime);

    return (
        <Card className="stake-card shadow-sm">
            <Card.Header className="d-flex justify-content-between align-items-center">
                <h3 className="mb-0">Stake #{stake.id + 1}</h3>
                <Badge bg={isCompleted ? "secondary" : "success"}>
                    {isCompleted ? "Completado" : "Activo"}
                </Badge>
            </Card.Header>
            <Card.Body>
                <div className="mb-2">
                    <strong>Cantidad:</strong> {stake.amount} cCOP
                </div>
                <div className="mb-2">
                    <strong>Inicio:</strong> {stake.startTime.toLocaleDateString()}
                </div>
                <div className="mb-2">
                    <strong>Duración:</strong> {stake.duration} días
                </div>
                <div className="mb-2">
                    <strong>Finaliza:</strong> {new Date(stake.endTime).toLocaleDateString()}
                </div>
                <div className="mb-2">
                    <strong>APY:</strong> <Badge bg="success">{stake.apy}%</Badge>
                </div>
                <div className="mb-3">
                    <strong>Recompensas:</strong> <span className="text-success">{stake.rewards} cCOP</span>
                </div>
                <div className="d-grid gap-2">
                    <Button variant="danger" onClick={() => onUnstake(stake.id)}>
                        Retirar Stake
                    </Button>
                    <Button variant="success" onClick={() => onClaim(stake.id)}>
                        Reclamar Recompensas
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
};

export default StakeCard; 