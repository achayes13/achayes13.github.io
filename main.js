var canvasWidth = 600;
var canvasHeight = 810;

var boardSize = 600;
var cellSize = 50;
var playerSize = 42;

var mmSize = 200;

var rows = 100;
var cols = 100;
var mmZoom = 16;
var board;
var player;
var cellBorderColor = "#333333";
var drawInterval = setInterval(drawGame, 20);
var pointerX = 0;
var pointerY = 0;
var toastText = null;
var toastQueue = [];
var victory = false;

var baseVisionRadius = 2;
var baseStamina = 20;
var baseStaminaRefeshAmount = 15;
var baseZoom = 1.0;

var isDebug = false;

var livesUsed = 0;
var distanceTravelled = 0;
var tilesRevealed = 0;

var usingMinimap = false;
var showStatUpgradeMenu = false;

var keyStructure = [
  ["G", "G", "G"],
  ["G", "K", "G"],
  ["G", "G", "G"],
];

var treasureStructure = [
  ["G", "G", "G", "G", "G", "G", "G"],
  ["G", "W", "W", "D", "W", "W", "G"],
  ["G", "W", "G", "G", "G", "W", "G"],
  ["G", "D", "G", "X", "G", "D", "G"],
  ["G", "W", "G", "G", "G", "W", "G"],
  ["G", "W", "W", "D", "W", "W", "G"],
  ["G", "G", "G", "G", "G", "G", "G"],
];

var entranceStructure = `GGGGGG
WWWWWW
GGSGGG
WWWWWW
GGGGGG
`;

function startGame() {
  console.log("penis");
  gameCanvas.start();
  createBoard();
  player = new Player();
  player.goToEntrance();
  drawGame();
}

function getPlayerSize() {
  return !usingMinimap ? playerSize * player.zoom : boardSize / (mmZoom * 2);
}

function getCellSize() {
  return !usingMinimap ? cellSize * player.zoom : boardSize / (mmZoom * 2);
}

function getColsRadius() {
  return Math.ceil((boardSize / getCellSize() - 1) / 2);
}

function getRowsRadius() {
  return Math.ceil((boardSize / getCellSize() - 1) / 2);
}

var gameCanvas = {
  canvas: document.createElement("canvas"),
  start: function () {
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.context = this.canvas.getContext("2d");
    document.body.insertBefore(this.canvas, document.body.childNodes[0]);
  },
};

function resetBoard() {
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      board[row][col].reset();
    }
  }
}

function startAnew() {
  resetBoard();
  board[player.row][player.col].addDeadPlayer(player);
  player = new Player();
  player.goToEntrance();
}

class Player {
  constructor() {
    livesUsed++;
    this.row = 0;
    this.col = 0;
    this.life = 10;
    this.stamina = baseStamina;
    this.zoom = baseZoom;
    this.visionLevel = baseVisionRadius;
    this.diedReason = "";
    this.isDead = false;
    this.numKeys = 0;
    this.staminaRefreshAmount = baseStaminaRefeshAmount;
    this.maxStamina = baseStamina;
    this.hasTreasure = false;
    this.revealedSquares = [];
    this.refreshStamina = function (customAmount = null) {
      this.stamina = Math.min(
        this.stamina +
          (customAmount != null ? customAmount : this.staminaRefreshAmount),
        this.maxStamina
      );
    };
    this.reveal = function (row, col) {
      if (this.revealedSquares[row] == null) {
        this.revealedSquares[row] = [col];
      } else if (!this.revealedSquares[row].includes(col)) {
        this.revealedSquares[row].push(col);
      }
    };
    this.useStaminaIfPossible = function (amount) {
      if (this.stamina < amount) {
        return false;
      }
      this.stamina -= amount;
      return true;
    };
    this.goToEntrance = function () {
      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          if (board[row][col].type == "ENTRANCE") {
            this.row = row;
            this.col = col;
            return;
          }
        }
      }
    };
    this.canSee = function (blockRow, blockCol) {
      var rowDist = Math.abs(this.row - blockRow);
      var colDist = Math.abs(this.col - blockCol);
      var isInRange = this.isInVisionRange(rowDist, colDist);
      return isInRange && !this.isObscuredTo(blockRow, blockCol);
    };

    this.isObscuredTo = function (blockRow, blockCol) {
      var rowStart = Math.min(this.row, blockRow);
      var rowEnd = Math.max(this.row, blockRow);
      var colStart = Math.min(this.col, blockCol);
      var colEnd = Math.max(this.col, blockCol);
      if (colStart == colEnd) {
        for (var row = rowStart + 1; row < rowEnd; row++) {
          if (board[row][colStart].isObscuring()) {
            return true;
          }
        }
      } else if (rowStart == rowEnd) {
        for (var col = colStart + 1; col < colEnd; col++) {
          if (board[rowStart][col].isObscuring()) {
            return true;
          }
        }
      } else {
        var slope =
          Math.abs(this.row - blockRow) / Math.abs(this.col - blockCol);
        var colDelta;
        var rowDelta;
        if (slope < 1) {
          var rowDelta = slope;
          var colDelta = 1;
        } else {
          var rowDelta = 1;
          var colDelta = 1.0 / slope;
        }

        var rowDir = this.row < blockRow ? 1 : -1;
        var colDir = this.col < blockCol ? 1 : -1;
        var rowLine = this.row;
        var colLine = this.col;
        while (rowLine != blockRow && colLine != blockCol) {
          var topLeft = board[Math.floor(rowLine)][
            Math.floor(colLine)
          ].isObscuring()
            ? 1
            : 0;
          var topRight = board[Math.floor(rowLine)][
            Math.ceil(colLine)
          ].isObscuring()
            ? 1
            : 0;
          var bottomLeft = board[Math.ceil(rowLine)][
            Math.floor(colLine)
          ].isObscuring()
            ? 1
            : 0;
          var bottomRight = board[Math.ceil(rowLine)][
            Math.ceil(colLine)
          ].isObscuring()
            ? 1
            : 0;
          if (topLeft + topRight + bottomLeft + bottomRight >= 2) {
            return true;
          }
          rowLine += rowDir * rowDelta;
          colLine += colDir * colDelta;
        }
      }
      return false;
    };

    this.isObscuredToPaint = function (blockRow, blockCol) {
      var rowStart = Math.min(this.row, blockRow);
      var rowEnd = Math.max(this.row, blockRow);
      var colStart = Math.min(this.col, blockCol);
      var colEnd = Math.max(this.col, blockCol);
      if (colStart == colEnd) {
        for (var row = rowStart + 1; row < rowEnd; row++) {
          if (board[row][colStart].isObscuring()) {
            return true;
          }
        }
      } else if (rowStart == rowEnd) {
        for (var col = colStart + 1; col < colEnd; col++) {
          if (board[rowStart][col].isObscuring()) {
            return true;
          }
        }
      } else {
        var slope =
          Math.abs(this.row - blockRow) / Math.abs(this.col - blockCol);
        var colDelta;
        var rowDelta;
        if (slope < 1) {
          var rowDelta = slope;
          var colDelta = 1;
        } else {
          var rowDelta = 1;
          var colDelta = 1.0 / slope;
        }

        var rowDir = this.row < blockRow ? 1 : -1;
        var colDir = this.col < blockCol ? 1 : -1;
        var rowLine = this.row;
        var colLine = this.col;
        while (rowLine != blockRow && colLine != blockCol) {
          var topLeft = board[Math.floor(rowLine)][
            Math.floor(colLine)
          ].isObscuring()
            ? 1
            : 0;
          var topRight = board[Math.floor(rowLine)][
            Math.ceil(colLine)
          ].isObscuring()
            ? 1
            : 0;
          var bottomLeft = board[Math.ceil(rowLine)][
            Math.floor(colLine)
          ].isObscuring()
            ? 1
            : 0;
          var bottomRight = board[Math.ceil(rowLine)][
            Math.ceil(colLine)
          ].isObscuring()
            ? 1
            : 0;
          board[Math.floor(rowLine)][Math.floor(colLine)].isMarked = true;
          board[Math.floor(rowLine)][Math.ceil(colLine)].isMarked = true;
          board[Math.ceil(rowLine)][Math.floor(colLine)].isMarked = true;
          board[Math.ceil(rowLine)][Math.ceil(colLine)].isMarked = true;
          if (topLeft + topRight + bottomLeft + bottomRight >= 2) {
            board[Math.floor(rowLine)][Math.floor(colLine)].markedColor =
              "#0000FF";
            board[Math.floor(rowLine)][Math.ceil(colLine)].markedColor =
              "#0000FF";
            board[Math.ceil(rowLine)][Math.floor(colLine)].markedColor =
              "#0000FF";
            board[Math.ceil(rowLine)][Math.ceil(colLine)].markedColor =
              "#0000FF";
            return true;
          }
          rowLine += rowDir * rowDelta;
          colLine += colDir * colDelta;
        }
      }
      return false;
    };

    this.isInVisionRange = function (rowDist, colDist) {
      var visionLevel = this.visionLevel;
      if (visionLevel == 0) {
        return rowDist == 0 && colDist == 0;
      } else if (visionLevel == 1) {
        return rowDist + colDist <= 1;
      } else if (visionLevel == 2) {
        return rowDist <= 1 && colDist <= 1;
      } else if (visionLevel == 3) {
        return rowDist + colDist < 3;
      } else if (visionLevel == 4) {
        return rowDist <= 2 && colDist <= 2 && rowDist + colDist < 4;
      } else {
        return rowDist + colDist < visionLevel - 1;
      }
    };

    this.draw = function () {
      var ctx = gameCanvas.context;
      ctx.fillStyle = "#FF0000";
      ctx.fillRect(
        (boardSize - getPlayerSize()) / 2,
        (boardSize - getPlayerSize()) / 2,
        getPlayerSize(),
        getPlayerSize()
      );
      var strokeStyle;
      if (this.hasTreasure) {
        strokeStyle = "#FF00FF";
      } else if (this.numKeys > 0) {
        strokeStyle = "#FFD700";
      }
      if (strokeStyle != null) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          (boardSize - getPlayerSize()) / 2,
          (boardSize - getPlayerSize()) / 2,
          getPlayerSize(),
          getPlayerSize()
        );
      }
    };

    this.tryMove = function (rowDelta, colDelta) {
      if (usingMinimap) {
        return;
      }
      var newRow = this.row + rowDelta;
      var newCol = this.col + colDelta;
      // out of bounds
      if (newRow < 0 || newCol < 0 || newRow >= rows || newCol >= cols) {
        return;
      }
      // impassable
      var block = board[newRow][newCol];
      if (!block.canVisit()) {
        return;
      }
      if (this.stamina <= 0) {
        player.isDead = true;
        player.diedReason = "Exhaustion";
        return;
      }
      var hasEnoughStam = player.useStaminaIfPossible(1);
      if (!hasEnoughStam) {
        return;
      }
      block.visit();
      this.row = newRow;
      this.col = newCol;
      distanceTravelled++;
      for (
        var row = newRow - this.visionLevel;
        row < newRow + player.visionLevel + 1;
        row++
      ) {
        for (
          var col = newCol - this.visionLevel;
          col < newCol + player.visionLevel + 1;
          col++
        ) {
          if (
            row >= 0 &&
            row < rows &&
            col >= 0 &&
            col < cols &&
            this.canSee(row, col)
          ) {
            board[row][col].revealed = true;
            tilesRevealed++;
            player.reveal(row, col);
          }
        }
      }
    };
  }
}

function revealSquares(rowCols) {
  rowCols.forEach((cols, row) => {
    cols.forEach((col) => {
      board[row][col].revealed = true;
      player.reveal(row, col);
    });
  });
}

function transferItems(toPlayer, fromPlayer) {
  if (fromPlayer.numKeys > 0) {
    toPlayer.numKeys += fromPlayer.numKeys;
    toast(fromPlayer.numKeys + " Key(s) Acquired!");
  }
  if (fromPlayer.hasTreasure) {
    toPlayer.hasTreasure = true;
    toast("Treasure acquired!");
  }
}

function transferUpgrades(toPlayer, fromPlayer) {
  if (fromPlayer.maxStamina > baseStamina) {
    toPlayer.maxStamina += fromPlayer.maxStamina - baseStamina;
    toPlayer.staminaRefreshAmount +=
      fromPlayer.staminaRefreshAmount - baseStaminaRefeshAmount;
    toast("Stamina Upgrade(s) Acquired!");
  }
  if (fromPlayer.zoom < baseZoom) {
    toPlayer.zoom *= fromPlayer.zoom;
    toast("Zoom Upgrade(s) Acquired!");
  }
  if (fromPlayer.visionLevel > baseVisionRadius) {
    toPlayer.visionLevel += fromPlayer.visionLevel - baseVisionRadius;
    toast("Vision Upgrade(s) Acquired!");
  }
}

function toast(text) {
  if (text != toastText) {
    toastQueue.push(text);
  }
}

class Block {
  constructor(row, col) {
    this.type = "GRASS";
    this.revealed = false;
    this.row = row;
    this.col = col;
    this.isMarked = false;
    this.markedColor = "#FF0000";
    this.deadPlayer = null;
    this.itemType = null;
    this.addDeadPlayer = function (player) {
      this.deadPlayer = player;
      this.setItem("DEAD_PLAYER");
      this.revealed = true;
    };
    this.setItem = function (itemType) {
      this.itemType = itemType;
    };
    this.setType = function (type) {
      this.type = type;
      this.revealed = true;
    };
    this.createFromCondensed = function (condensedType) {
      var itemType = this.getItemTypeFromCodensed(condensedType);
      if (itemType != null) {
        isDebug ? this.setType("GRASS") : this.create("GRASS");
        this.setItem(itemType);
      } else {
        var type = this.getTypeFromCondensed(condensedType);
        isDebug ? this.setType(type) : this.create(type);
      }
    };
    this.getItemTypeFromCodensed = function (condensedType) {
      switch (condensedType) {
        case "K":
          return "KEY";
        default:
          return null;
      }
    };
    this.getTypeFromCondensed = function (condensedType) {
      switch (condensedType) {
        case "G":
          return "GRASS";
        case "W":
          return "WALL";
        case "D":
          return "LOCKED_DOOR";
        case "X":
          return "TREASURE";
        default:
          return "GRASS";
      }
    };
    this.reset = function () {
      if (this.itemType == "STAMINA_ORB_USED") {
        this.setItem("STAMINA_ORB");
      }
      switch (this.type) {
        case "PATH":
          this.type = "PATH_AGE_1";
          break;
        case "PATH_AGE_1":
          this.type = "PATH_AGE_2";
          break;
        case "PATH_AGE_2":
          this.type = "PATH_AGE_3";
          break;
        case "PATH_AGE_3":
          this.type = "PATH_AGE_4";
          break;
        case "PATH_AGE_4":
          this.type = "PATH_AGE_5";
          break;
        case "PATH_AGE_5":
          this.type = "GRASS";
          break;
      }
      if (this.type != "EXTERIOR_WALL" && this.itemType != "DEAD_PLAYER") {
        this.revealed = false;
      }
    };
    this.create = function (type) {
      this.type = type;
      this.itemType = null;
      this.deadPlayer = null;
    };
    this.isTraversable = function () {
      return this.type != "WALL" && this.type != "EXTERIOR_WALL";
    };
    this.isObscuring = function () {
      return ["WALL", "EXTERIOR_WALL", "LOCKED_DOOR"].includes(this.type);
    };
    this.canVisit = function () {
      if (this.type == "LOCKED_DOOR" && player.numKeys <= 0) {
        toast("Need a key to unlock this door!");
        return false;
      }
      if (this.type == "ENTRANCE" && !player.hasTreasure) {
        toast("Find the treasure, and only then you may leave!");
        return false;
      }
      return this.isTraversable();
    };
    // assumed canVisit = true
    this.visit = function () {
      if (this.type == "TREASURE") {
        player.hasTreasure = true;
        toast("Treasure acquired! Now bring it back to the entrance!");
      }
      if (this.type == "ENTRANCE") {
        victory = true;
      }
      if (this.itemType == "DEAD_PLAYER") {
        toast("Map Updated!");
        revealSquares(this.deadPlayer.revealedSquares);
        transferItems(player, this.deadPlayer);
        transferUpgrades(player, this.deadPlayer);
        this.setItem(null);
      }
      if (this.itemType == "STAMINA_ORB") {
        this.setItem("STAMINA_ORB_USED");
        player.refreshStamina();
        toast("Stamina +" + player.staminaRefreshAmount);
      }
      if (this.itemType == "STAT_UPGRADE") {
        this.setItem(null);
        showStatUpgradeMenu = true;
        player.refreshStamina(10);
      }
      if (this.itemType == "KEY") {
        this.setItem(null);
        player.numKeys++;
        toast("Key Acquired!");
      }
      if (this.type == "LOCKED_DOOR") {
        player.numKeys -= 1;
        toast("Door Unlocked - 1 Key Used");
      }
      this.type = "PATH";
    };
    this.getMMColor = function () {
      var color = "#AAAAAA";
      if (this.revealed) {
        switch (this.itemType) {
          case "KEY":
            return "#FFD700";
          case "DEAD_PLAYER":
            return "#FF0000";
          case "STAMINA_ORB_USED":
            return "#759CC9";
          case "STAMINA_ORB":
            return "#0000FF";
          case "STAT_UPGRADE":
            return "#E17CB0";
          default:
            break;
        }
        switch (this.type) {
          case "GRASS":
            color = "#00FF00";
            break;
          case "PATH_AGE_5":
            color = "#36FB00";
            break;
          case "PATH_AGE_4":
            color = "#56CB00";
            break;
          case "PATH_AGE_3":
            color = "#66AB00";
            break;
          case "PATH_AGE_2":
            color = "#768B00";
            break;
          case "PATH_AGE_1":
            color = "#866B00";
            break;
          case "PATH":
            color = "#964B00";
            break;
          case "EXTERIOR_WALL":
            color = "#333333";
            break;
          case "WALL":
            color = "#E3CC6C";
            break;
          case "ENTRANCE":
            color = "#0000FF";
            break;
          case "PLAYER":
            color = "#FF0000";
            break;
          case "TREASURE":
            color = "#FF00FF";
            break;
          case "LOCKED_DOOR":
            color = "#008888";
            break;
          default:
            color = "#000000";
            break;
        }
      }
      return color;
    };
    this.draw = function (x, y, ignoreVisibility = false) {
      var color;
      var itemColor;
      var itemBorder;
      var canSee = player.canSee(this.row, this.col);
      if (!this.revealed && !canSee) {
        color = "#AAAAAA";
      } else {
        switch (this.type) {
          case "GRASS":
            color = "#00FF00";
            break;
          case "PATH_AGE_5":
            color = "#36FB00";
            break;
          case "PATH_AGE_4":
            color = "#56CB00";
            break;
          case "PATH_AGE_3":
            color = "#66AB00";
            break;
          case "PATH_AGE_2":
            color = "#768B00";
            break;
          case "PATH_AGE_1":
            color = "#866B00";
            break;
          case "PATH":
            color = "#964B00";
            break;
          case "EXTERIOR_WALL":
            color = "#333333";
            break;
          case "WALL":
            color = "#E3CC6C";
            break;
          case "ENTRANCE":
            color = "#0000FF";
            break;
          case "PLAYER":
            color = "#FF0000";
            break;
          case "TREASURE":
            color = "#FF00FF";
            break;
          case "LOCKED_DOOR":
            color = "#008888";
            break;
          default:
            color = "#000000";
            break;
        }
        switch (this.itemType) {
          case "DEAD_PLAYER":
            itemColor = "#FF0000";
            if (this.deadPlayer.numKeys > 0) {
              itemBorder = "#FFD700";
            }
            if (this.deadPlayer.hasTreasure > 0) {
              itemBorder = "#FF00FF";
            }
            break;
          case "STAMINA_ORB_USED":
            itemBorder = "#0000FF";// = "#759CC9";
            break;
          case "STAMINA_ORB":
            itemColor = "#0000FF";
            break;
          case "KEY":
            itemColor = "#FFD700";
            break;
          case "STAT_UPGRADE":
            itemColor = "#E17CB0";
            break;
          default:
            break;
        }
      }
      var ctx = gameCanvas.context;
      gameCanvas.context.fillStyle = color;
      gameCanvas.context.fillRect(x, y, getCellSize(), getCellSize());
      gameCanvas.context.strokeStyle = cellBorderColor;
      gameCanvas.context.lineWidth = 2;
      if (itemColor != null) {
        gameCanvas.context.fillStyle = itemColor;
        ctx.beginPath();
        ctx.arc(
          x + getCellSize() / 2,
          y + getCellSize() / 2,
          getCellSize() / 3,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
      if (itemBorder != null) {
        gameCanvas.context.strokeStyle = itemBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          x + getCellSize() / 2,
          y + getCellSize() / 2,
          getCellSize() / 3,
          0,
          2 * Math.PI
        );
        ctx.stroke();
      }
      if (!canSee && this.revealed && !ignoreVisibility) {
        gameCanvas.context.globalAlpha = 0.4;
        gameCanvas.context.fillStyle = "#444444";
        gameCanvas.context.fillRect(x, y, getCellSize(), getCellSize());
        gameCanvas.context.globalAlpha = 1;
      }
      if (this.isMarked) {
        gameCanvas.context.globalAlpha = 0.8;
        gameCanvas.context.fillStyle = this.markedColor;
        gameCanvas.context.fillRect(x, y, getCellSize(), getCellSize());
        gameCanvas.context.globalAlpha = 1;
      }
    };
  }
}

function randIntInclusive(min, max) {
  return Math.floor(Math.random() * (max + 1 - min)) + min;
}

function createBoard() {
  board = Array(rows);
  for (var row = 0; row < rows; row++) {
    board[row] = Array(cols);
    for (var col = 0; col < cols; col++) {
      board[row][col] = new Block(row, col);
    }
  }

  // Make exterior walls
  for (var col = 0; col < cols; col++) {
    board[0][col].setType("EXTERIOR_WALL");
    board[rows - 1][col].setType("EXTERIOR_WALL");
  }
  for (var row = 0; row < rows; row++) {
    board[row][0].setType("EXTERIOR_WALL");
    board[row][cols - 1].setType("EXTERIOR_WALL");
  }

  // Make Entrance
  var entranceRow = randIntInclusive(20, rows - 20);
  board[entranceRow][0].setType("ENTRANCE");

  // Random walls
  var numWalls = 200;
  var wallsCreated = 0;
  while (wallsCreated < numWalls) {
    var wallLength = randIntInclusive(3, 9);
    if (Math.random() > 0.5) {
      var wallStartRow = randIntInclusive(1, rows - 2 - wallLength);
      var wallEndRow = wallStartRow + wallLength;
      var col = randIntInclusive(1, cols - 2);
      for (var row = wallStartRow; row <= wallEndRow; row++) {
        board[row][col].create("WALL");
      }
    } else {
      var wallStartCol = randIntInclusive(1, cols - 2 - wallLength);
      var wallEndCol = wallStartCol + wallLength;
      var row = randIntInclusive(1, rows - 2);
      for (var col = wallStartCol; col <= wallEndCol; col++) {
        board[row][col].create("WALL");
      }
    }
    wallsCreated++;
  }

  board[entranceRow][1].create("GRASS");
  board[entranceRow][2].create("GRASS");
  board[entranceRow][2].setItem("STAT_UPGRADE");
  board[entranceRow][3].create("GRASS");
  board[entranceRow][4].create("GRASS");
  board[entranceRow][4].setItem("STAMINA_ORB");

  // Stamina orbs - 3 per 25x25 chunk
  for (var col = 0; col <= cols - 25; col += 25) {
    for (var row = 0; row <= rows - 25; row += 25) {
      var numPlaced = 0;
      while (numPlaced < 3) {
        var randRow = randIntInclusive(row, row + 24);
        var randCol = randIntInclusive(col, col + 24);
        if (board[randRow][randCol].isTraversable()) {
          board[randRow][randCol].setItem("STAMINA_ORB");
          numPlaced++;
        }
      }
    }
  }

  // Stat Upgrades - 3 per 25x25 chunk
  for (var col = 0; col <= cols - 25; col += 25) {
    for (var row = 0; row <= rows - 25; row += 25) {
      var numPlaced = 0;
      while (numPlaced < 2) {
        var randRow = randIntInclusive(row, row + 24);
        var randCol = randIntInclusive(col, col + 24);
        if (
          board[randRow][randCol].isTraversable() &&
          board[randRow][randCol].itemType == null
        ) {
          board[randRow][randCol].setItem("STAT_UPGRADE");
          numPlaced++;
        }
      }
    }
  }

  // Keys - 2 somewhere on the map.
  var keysPlaced = 0;
  var keyRows = keyStructure.length;
  var keyCols = keyStructure[0].length;
  while (keysPlaced < 2) {
    var startRow, startCol;
    var dist = isDebug ? 1999 : 0;
    while (isDebug ? dist > 5 : dist < (rows + cols) / 2) {
      startRow = randIntInclusive(2, rows - 3 - keyRows);
      startCol = randIntInclusive(2, cols - 3 - keyCols);
      dist = Math.abs(startRow - entranceRow) + startCol;
    }
    for (var row = 0; row < keyRows; row++) {
      for (var col = 0; col < keyCols; col++) {
        board[startRow + row][startCol + col].createFromCondensed(
          keyStructure[row][col]
        );
      }
    }
    keysPlaced++;
  }

  // Install treasure
  var treasureRows = treasureStructure.length;
  var treasureCols = treasureStructure[0].length;
  var startRow, startCol;
  var dist = isDebug ? 10000 : 0;
  while (isDebug ? dist > 10 : dist < (rows + cols) / 3) {
    startRow = randIntInclusive(2, rows - 3 - treasureRows);
    startCol = randIntInclusive(2, cols - 3 - treasureCols);
    dist = Math.abs(startRow - entranceRow) + startCol;
  }
  for (var row = 0; row < treasureRows; row++) {
    for (var col = 0; col < treasureCols; col++) {
      board[startRow + row][startCol + col].createFromCondensed(
        treasureStructure[row][col]
      );
    }
  }
}

function drawBoard() {
  var centerRow = player.row;
  var centerCol = player.col;
  var colsRadius = getColsRadius();
  var rowsRadius = getRowsRadius();
  var firstRow = centerRow - rowsRadius;
  var lastRow = centerRow + rowsRadius;
  var firstCol = centerCol - colsRadius;
  var lastCol = centerCol + colsRadius;
  var widthOffset = (colsRadius * 2 * getCellSize() - boardSize) / 2;
  var heightOffset = (rowsRadius * 2 * getCellSize() - boardSize) / 2;
  for (var row = firstRow; row < lastRow + 1; row++) {
    for (var col = firstCol; col < lastCol + 1; col++) {
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        board[row][col].draw(
          (col - firstCol) * getCellSize() - getCellSize() / 2.0 - widthOffset,
          (row - firstRow) * getCellSize() - getCellSize() / 2.0 - heightOffset
        );
      }
    }
  }
}

function drawEndgame() {
  var ctx = gameCanvas.context;
  ctx.font = "30px sans-serif";
  gameCanvas.context.fillStyle = "#000000";
  ctx.fillText("You have died of " + player.diedReason + ".", 10, 50);
  ctx.font = "25px sans-serif";
  ctx.fillText("But your legacy lives on!", 10, 80);
  ctx.fillText("A new generation of explorer has come", 10, 110);
  ctx.fillText("to finish what you started", 10, 140);
  ctx.fillText("Press F to pay respects and start anew.", 10, 170);
}

function drawVictory() {
  var ctx = gameCanvas.context;
  ctx.font = "30px sans-serif";
  gameCanvas.context.fillStyle = "#000000";
  if (livesUsed == 1) {
    ctx.fillText("Holy shit, you found the treasure and", 10, 50);
    ctx.fillText("escaped in one generation? Insane.", 10, 80);
  } else {
    ctx.fillText("Congrats, after " + livesUsed + " generations,", 10, 50);
    ctx.fillText("you found the treasure and escaped!", 10, 80);
  }
  ctx.font = "25px sans-serif";
  ctx.fillText("Stats:", 10, 110);
  ctx.fillText("Generations of explorers: " + livesUsed, 10, 140);
  ctx.fillText("Tiles travelled: " + distanceTravelled, 10, 170);
  ctx.fillText("Tiles revealed: " + tilesRevealed, 10, 200);
}

function drawStatsUpgradeMenu() {
  var ctx = gameCanvas.context;
  ctx.font = "25px sans-serif";
  gameCanvas.context.fillStyle = "#000000";
  ctx.fillText("Stats Upgrade Acquired! +5 Stam", 10, 50);
  ctx.font = "15px sans-serif";
  ctx.fillText("Press 1 to Upgrade Max Stamina and Refresh Amount", 10, 80);
  ctx.fillText(
    "Current Max Stamina: " + player.maxStamina + " (Upgrade: +10)",
    10,
    110
  );
  ctx.fillText("Press 2 to Upgrade Vision Level", 10, 140);
  ctx.fillText(
    "Current Vision Level: " + player.visionLevel + " (Upgrade: +1)",
    10,
    170
  );
  ctx.fillText("Press 3 to Upgrade Zoom Level By 10%", 10, 200);
}

function drawGame() {
  var ctx = gameCanvas.context;
  gameCanvas.context.fillStyle = "#EEEEEE";
  gameCanvas.context.fillRect(0, 0, canvasWidth, canvasHeight);
  if (player.isDead) {
    drawEndgame();
    return;
  }
  if (victory) {
    drawVictory();
    return;
  }
  if (showStatUpgradeMenu) {
    drawStatsUpgradeMenu();
    return;
  }
  if (!usingMinimap) {
    drawBoard();
    player.draw();
  }
  gameCanvas.context.fillStyle = "#333333";
  gameCanvas.context.fillRect(0, boardSize, canvasWidth, 10);
  gameCanvas.context.fillStyle = "#CCCCCC";
  gameCanvas.context.fillRect(
    0,
    boardSize + 10,
    canvasWidth,
    canvasHeight - boardSize - 10
  );
  drawMinimap();
  drawStats();
  if (toastText == null && toastQueue.length > 0) {
    toastText = toastQueue.shift();
    setTimeout(() => (toastText = null), 2500);
  }
  drawToast();
}

function drawToast() {
  if (toastText == null) {
    return;
  }
  var ctx = gameCanvas.context;
  gameCanvas.context.strokeStyle = "#333333";
  gameCanvas.context.lineWidth = 2;
  ctx.strokeRect(0, 565, canvasWidth, 35)
  gameCanvas.context.fillStyle = "#BBBBBB";
  ctx.fillRect(0, 565, canvasWidth, 35)
  ctx.font = "20px sans-serif";
  gameCanvas.context.fillStyle = "#000000";
  var prefix = toastQueue.length > 0 ? "[" + toastQueue.length + "] " : "";
  ctx.fillText(prefix + toastText, 5, 590);
}

function drawStats() {
  var ctx = gameCanvas.context;
  ctx.font = "30px sans-serif";
  gameCanvas.context.fillStyle = "#FF0000";
  ctx.fillText("LIFE: " + player.life, 5, 650);
  gameCanvas.context.fillStyle = "#0000AA";
  ctx.fillText("STAM: " + player.stamina + "/" + player.maxStamina, 5, 680);
}

function drawMinimap() {
  var ctx = gameCanvas.context;
  var squareSize = mmSize / cols;
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      ctx.fillStyle = board[row][col].getMMColor();
      ctx.fillRect(
        400 + col * squareSize,
        610 + row * squareSize,
        squareSize,
        squareSize
      );
    }
  }
  ctx.fillStyle = "#FF0000";
  ctx.fillRect(
    400 + player.col * squareSize,
    610 + player.row * squareSize,
    squareSize,
    squareSize
  );

  if (usingMinimap) {
    var centerRow = Math.floor(
      Math.min(Math.max((pointerY - 610) / squareSize, mmZoom), rows - mmZoom)
    );
    var centerCol = Math.floor(
      Math.min(Math.max((pointerX - 400) / squareSize, mmZoom), rows - mmZoom)
    );
    var firstRow = centerRow - mmZoom;
    var lastRow = centerRow + mmZoom - 1;
    var firstCol = centerCol - mmZoom;
    var lastCol = centerCol + mmZoom - 1;
    var zoomSize = squareSize * mmZoom * 2;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#FDD400";
    ctx.fillRect(
      400 + firstCol * squareSize,
      610 + firstRow * squareSize,
      zoomSize,
      zoomSize
    );
    ctx.globalAlpha = 1.0;

    var widthOffset = (mmZoom * 2 * getCellSize() - boardSize) / 2;
    var heightOffset = (mmZoom * 2 * getCellSize() - boardSize) / 2;
    for (var row = firstRow; row < lastRow + 1; row++) {
      for (var col = firstCol; col < lastCol + 1; col++) {
        if (row >= 0 && row < rows && col >= 0 && col < cols) {
          board[row][col].draw(
            (col - firstCol) * getCellSize() -
              getCellSize() / 2.0 -
              widthOffset,
            (row - firstRow) * getCellSize() -
              getCellSize() / 2.0 -
              heightOffset,
            true
          );
        }
      }
    }
    if (
      player.row <= lastRow &&
      player.row >= firstRow &&
      player.col <= lastCol &&
      player.col >= firstCol
    ) {
      ctx.fillStyle = "#FF0000";
      ctx.fillRect(
        (player.col - firstCol) * getCellSize() -
          getCellSize() / 2.0 -
          widthOffset,
        (player.row - firstRow) * getCellSize() -
          getCellSize() / 2.0 -
          heightOffset,
        getCellSize(),
        getCellSize()
      );
    }
  }
}

window.addEventListener("keydown", function (event) {
  switch (event.key) {
    case "1":
      if (showStatUpgradeMenu) {
        showStatUpgradeMenu = false;
        player.maxStamina += 10;
        player.staminaRefreshAmount += 5;
        toast("Max Stamina Upgraded!");
      }
      break;
    case "2":
      if (showStatUpgradeMenu) {
        showStatUpgradeMenu = false;
        player.visionLevel += 1;
        toast("Vision Level Upgraded!");
      }
      break;
    case "3":
      if (showStatUpgradeMenu) {
        showStatUpgradeMenu = false;
        player.zoom *= 0.9;
        toast("Zoom Level Upgraded!");
      }
      break;
    case "ArrowRight":
      player.tryMove(0, 1);
      break;
    case "ArrowLeft":
      player.tryMove(0, -1);
      break;
    case "ArrowUp":
      player.tryMove(-1, 0);
      break;
    case "ArrowDown":
      player.tryMove(1, 0);
      break;
    case "]":
      player.zoom += 0.1;
      break;
    case "[":
      if (player.zoom > 0.2) {
        player.zoom -= 0.1;
      }
      break;
    case ".":
      player.visionLevel += 1;
      break;
    case "f":
      if (player.isDead) {
        startAnew();
      }
      break;
    case ",":
      if (player.visionLevel > 0) {
        player.visionLevel -= 1;
      }
      break;
    case "s":
      player.stamina += 1;
      break;
    default:
      console.log(event.key);
      return;
  }
});

window.addEventListener("pointermove", function (event) {
  pointerX = event.clientX - 10;
  pointerY = event.clientY - 10;
});

window.addEventListener("pointerdown", function (event) {
  var cx = event.clientX - 10;
  var cy = event.clientY - 10;
  if (cx > 400 && cx < 400 + mmSize && cy > 610 && cy < 610 + mmSize) {
    usingMinimap = true;
  }
});

window.addEventListener("pointerup", function (event) {
  usingMinimap = false;
});

window.addEventListener("wheel", function (e) {
  if (e.deltaY > 0 && mmZoom * 2 < rows) {
    mmZoom += 1;
  } else if (e.deltaY < 0 && mmZoom * 2 > 2) {
    mmZoom -= 1;
  }
});
