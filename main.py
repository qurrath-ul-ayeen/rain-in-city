import pygame
import random
import sys

# Configuration
WIDTH, HEIGHT = 800, 600
BUILDING_COUNT = 8
RAINDROP_COUNT = 80
FPS = 60

class Raindrop:
    def __init__(self):
        self.x = random.randint(0, WIDTH)
        self.y = random.randint(-HEIGHT, 0)
        self.length = random.randint(8, 18)
        self.speed = random.uniform(4, 10)
        self.color = (138, 43, 226)
    
    def fall(self):
        self.y += self.speed
        if self.y > HEIGHT:
            self.y = random.randint(-HEIGHT, 0)
            self.x = random.randint(0, WIDTH)

    def draw(self, screen):
        pygame.draw.line(screen, self.color, (self.x, self.y), (self.x, self.y + self.length), 2)

def generate_buildings():
    buildings = []
    ground_level = HEIGHT - 70
    width_per_building = WIDTH // BUILDING_COUNT
    for i in range(BUILDING_COUNT):
        building_height = random.randint(100, 250)
        x = i * width_per_building
        y = ground_level - building_height
        building = pygame.Rect(x + 10, y, width_per_building - 20, building_height)
        buildings.append(building)
    return buildings

def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Rain in City Simulation")
    clock = pygame.time.Clock()

    # Generate buildings and raindrops
    buildings = generate_buildings()
    raindrops = [Raindrop() for _ in range(RAINDROP_COUNT)]

    ground_level = HEIGHT - 70

    running = True
    while running:
        screen.fill((20, 20, 30))  # night sky color

        # Draw moon
        pygame.draw.circle(screen, (220, 220, 180), (WIDTH - 80, 80), 40)

        # Draw buildings
        for b in buildings:
            pygame.draw.rect(screen, (60, 60, 70), b)
            # Windows
            for i in range(b.y + 20, b.y + b.height - 20, 35):
                for j in range(b.x + 10, b.x + b.width - 20, 30):
                    if random.random() < 0.4:
                        pygame.draw.rect(screen, (200, 200, 80), (j, i, 18, 12))

        # Draw road
        pygame.draw.rect(screen, (40, 40, 45), (0, ground_level, WIDTH, 70))
        for i in range(0, WIDTH, 70):
            pygame.draw.rect(screen, (220, 220, 220), (i + 15, ground_level + 25, 40, 10))

        # Raindrops
        for drop in raindrops:
            drop.fall()
            drop.draw(screen)

        # Event handling
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        pygame.display.flip()
        clock.tick(FPS)
    
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()
