/* Mini-RPG engine (JS) - Prototype
   Tout en un fichier : classes, combat, UI et logique de loot/level.
   Texte et messages en français pour clarté.
*/

// --- Configuration et formules -------------------------------------------------
const CONFIG = {
  MAX_LEVEL: 50,
  BASE_XP: 100,
  XP_GROWTH: 1.45, // exponentiel modéré
  CRIT_LUCK_FACTOR: 0.02, // chaque point de chance ajoute
  DROP_BASE: 0.15, // chance de drop d'objet
}

function xpNeededFor(level){
  if(level<=1) return 0;
  return Math.floor(CONFIG.BASE_XP * Math.pow(level-1, CONFIG.XP_GROWTH));
}

// Stats structure and helpers
function baseStatIncrease(level){
  // augmentations par niveau: donne un vecteur de gains
  return {
    hp: Math.floor(10 + level*1.8),
    mp: Math.floor(5 + level*1.2),
    atk: Math.floor(2 + level*0.9),
    def: Math.floor(1 + level*0.8),
    mag: Math.floor(1 + level*0.9),
    mdef: Math.floor(1 + level*0.8),
    spd: Math.floor(1 + level*0.25),
    critRate: 0,
    critDmg: 0,
    acc: 0,
    eva: 0,
    luck: 0
  }
}

// Damage formula (physical)
function calcPhysicalDamage(attacker, target, power=1){
  // Attack and defense interplay. Defense reduces incoming damage multiplicatively.
  const atk = attacker.atk;
  const def = target.def;
  const base = Math.max(1, (atk * power) - Math.floor(def * 0.6));
  return applyCritAndVariance(attacker, target, base);
}

function calcMagicDamage(attacker, target, power=1){
  const mag = attacker.mag;
  const mdef = target.mdef;
  const base = Math.max(1, (mag * power) - Math.floor(mdef * 0.5));
  return applyCritAndVariance(attacker, target, base);
}

function applyCritAndVariance(attacker, target, base){
  // Hit check: accuracy vs evasion
  const hitRoll = Math.random()*100;
  const hitChance = Math.max(5, Math.min(99, 80 + attacker.acc - target.eva));
  if(hitRoll > hitChance) return { hit:false, dmg:0, crit:false };

  // Crit check
  const luckBonus = attacker.luck * CONFIG.CRIT_LUCK_FACTOR;
  const critChance = Math.max(0, attacker.critRate + luckBonus);
  const isCrit = Math.random()*100 < critChance;
  const critMult = isCrit ? (1 + attacker.critDmg/100) : 1;

  // Small damage variance
  const variance = (0.9 + Math.random()*0.2);
  const final = Math.max(1, Math.floor(base * critMult * variance));
  return { hit:true, dmg: final, crit: isCrit };
}

// --- Entités du jeu -------------------------------------------------------------
class Entity {
  constructor(data){
    this.name = data.name || 'Entité';
    this.level = data.level || 1;
    this.maxHp = data.maxHp || 50;
    this.hp = data.hp || this.maxHp;
    this.maxMp = data.maxMp || 20;
    this.mp = data.mp || this.maxMp;
    this.atk = data.atk || 5;
    this.def = data.def || 3;
    this.mag = data.mag || 3;
    this.mdef = data.mdef || 2;
    this.spd = data.spd || 5;
    this.critRate = data.critRate || 5; // %
    this.critDmg = data.critDmg || 50; // % over base
    this.acc = data.acc || 0;
    this.eva = data.eva || 0;
    this.luck = data.luck || 0;
    this.status = []; // status effects
    this.buffs = {}; // stat multipliers/adds
    this.skills = data.skills || [];
    this.equipment = data.equipment || [];
    this.xp = data.xp || 0;
    this.xpNext = xpNeededFor(this.level+1);
  }

  isAlive(){ return this.hp>0 }
}

class Player extends Entity{
  constructor(name, cls){
    const start = CLASS_TEMPLATES[cls];
    super({
      name: name || 'Héros',
      level: 1,
      maxHp: start.hp,
      maxMp: start.mp,
      atk: start.atk,
      def: start.def,
      mag: start.mag,
      mdef: start.mdef,
      spd: start.spd,
      critRate: start.critRate,
      critDmg: start.critDmg,
      acc: start.acc,
      eva: start.eva,
      luck: start.luck,
      skills: JSON.parse(JSON.stringify(start.skills))
    });
    this.cls = cls;
    this.pickedChoices = [];
    this.skillPoints = 0; // points pour déverrouiller compétences
    this.unlockedSkills = []; // ids déverrouillés via arbre
    this.gold = 100; // monnaie de départ
    this.equipment = {}; // slots -> item
  }

  gainXP(amount){
    if(this.level>=CONFIG.MAX_LEVEL) return;
    this.xp += amount;
    while(this.xp >= xpNeededFor(this.level+1) && this.level < CONFIG.MAX_LEVEL){
      this.levelUp();
    }
  }

  levelUp(){
    this.level += 1;
    const inc = baseStatIncrease(this.level);
    this.maxHp += inc.hp;
    this.maxMp += inc.mp;
    this.atk += inc.atk;
    this.def += inc.def;
    this.mag += inc.mag;
    this.mdef += inc.mdef;
    this.spd += inc.spd;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    // grant 1 skill point per level
    this.skillPoints += 1;
    UI.log(`Niveau ${this.level} atteint : +stats appliquées. +1 point de compétence (total: ${this.skillPoints}).`);
    if(this.level % 5 === 0){
      UI.log(`Palier ${this.level} : choisissez une amélioration de palier.`);
      this.showLevelChoice();
    }
  }

  showLevelChoice(){
    const opts = [
      {k:'atk', label:'+5 Attaque'},
      {k:'mag', label:'+5 Magie'},
      {k:'def', label:'+5 Défense'},
      {k:'spd', label:'+3 Vitesse'},
      {k:'hp', label:'+30 PV'}
    ];
    // simple UI prompt
    const choice = prompt(`Choisissez amélioration pour niveau ${this.level}\n1:${opts[0].label} 2:${opts[1].label} 3:${opts[2].label} 4:${opts[3].label} 5:${opts[4].label}`,'1');
    const idx = Math.max(0, Math.min(4, parseInt(choice||'1')-1));
    const pick = opts[idx];
    if(pick.k==='hp') this.maxHp += 30; else this[pick.k] += (pick.k==='spd'?3:5);
    UI.log(`Choix appliqué: ${pick.label}`);
  }
}

class Enemy extends Entity{
  constructor(template, level=1){
    const t = ENEMY_TEMPLATES[template];
    const scale = 1 + (level-1)*0.12;
    super({
      name: t.name,
      level: level,
      maxHp: Math.floor(t.hp*scale),
      maxMp: Math.floor(t.mp*scale),
      atk: Math.floor(t.atk*scale),
      def: Math.floor(t.def*scale),
      mag: Math.floor(t.mag*scale),
      mdef: Math.floor(t.mdef*scale),
      spd: Math.floor(t.spd*scale),
      critRate: t.critRate || 5,
      critDmg: t.critDmg || 50,
      acc: t.acc || 0,
      eva: t.eva || 0,
      luck: t.luck || 0,
      skills: JSON.parse(JSON.stringify(t.skills || []))
    });
    this.cooldowns = {};
    this.isBoss = !!(t && t.boss);
    (this.skills||[]).forEach(s=>{ if(s.cooldown) this.cooldowns[s.id] = 0; });
  }
}

// --- Données de base (classes, skills, ennemis, équipements) --------------------
const CLASS_TEMPLATES = {
  Guerrier: { hp:120, mp:20, atk:18, def:12, mag:6, mdef:8, spd:8, critRate:6, critDmg:50, acc:5, eva:3, luck:4,
    skills:[{id:'slash',name:'Coup Tranchant',type:'phys',power:1.0,cost:0,desc:'Attaque physique simple.'},{id:'taunt',name:'Provocation',type:'support',power:0,cost:5,desc:'Augmente défense, attire l\'aggro.'}]
  },
  Mage: { hp:80, mp:60, atk:6, def:5, mag:20, mdef:12, spd:7, critRate:4, critDmg:60, acc:6, eva:4, luck:5,
    skills:[{id:'fire',name:'Boule de Feu',type:'mag',power:1.5,cost:10,element:'feu',desc:'Dégâts magiques élémentaires.'},{id:'silence',name:'Silence',type:'debuff',power:0,cost:12,desc:'Empêche l\'ennemi d\'utiliser compétences.'}]
  },
  Voleur: { hp:90, mp:30, atk:14, def:7, mag:6, mdef:6, spd:14, critRate:12, critDmg:75, acc:10, eva:8, luck:10,
    skills:[{id:'stab',name:'Estoc',type:'phys',power:1.2,cost:0,desc:'Attaque rapide avec haut taux de critique.'},{id:'steal',name:'Vol',type:'utility',power:0,cost:8,desc:'Vole un objet ou de l\'or.'}]
  }
};

const ENEMY_TEMPLATES = {
  rat: { name:'Rat', hp:30, mp:0, atk:6, def:2, mag:0, mdef:1, spd:10, skills:[{id:'bite',name:'Morsure',type:'phys',power:1.0}] },
  gobelin: { name:'Gobelin', hp:60, mp:8, atk:10, def:4, mag:0, mdef:2, spd:9, skills:[{id:'swing',name:'Frappe',type:'phys',power:1.0}]},
  boss_demo: { name:'Goliath', hp:450, mp:40, atk:28, def:18, mag:8, mdef:12, spd:6, skills:[{id:'smash',name:'Écrasement',type:'phys',power:1.4,cooldown:2},{id:'stomp',name:'Piétinement',type:'phys',power:1.1,cooldown:3}]}
};

// mark boss flags (additional tuning)
ENEMY_TEMPLATES.boss_demo.boss = true;

const EQUIP_RARITIES = ['Commun','Rare','Épique','Légendaire'];

function randomEquipment(level, luck){
  const baseR = Math.random();
  let rar = 0;
  if(baseR > 0.97 + luck*0.001) rar = 3;
  else if(baseR > 0.90 + luck*0.002) rar = 2;
  else if(baseR > 0.6) rar = 1;
  else rar = 0;
  const slot = ['Arme','Armure','Casque','Bottes','Accessoire'][Math.floor(Math.random()*5)];
  const stats = {atk:0,def:0,mag:0,mdef:0,spd:0,hp:0,mp:0};
  // simple scaling
  stats.atk = Math.floor((rar+1) * (2 + level*0.5));
  stats.def = Math.floor((rar) * (1 + level*0.4));
  return {name:`${EQUIP_RARITIES[rar]} ${slot}`,rarity:EQUIP_RARITIES[rar],stats,slot};
}

// --- Skill trees --------------------------------------------------------------
const SKILL_TREES = {
  Guerrier: [
    {id:'slash',name:'Coup Tranchant',type:'phys',desc:'Attaque physique basique.',cost:0,req:[]},
    {id:'cleave',name:'Coup Circulaire',type:'phys',desc:'Attaque de zone légère.',cost:1,req:['slash']},
    {id:'fortitude',name:'Fortitude',type:'passive',desc:'+10% PV max.',cost:1,req:['slash']},
    {id:'provoke',name:'Provocation',type:'support',desc:'Attire l\'aggro et augmente la défense.',cost:2,req:['cleave']}
  ],
  Mage: [
    {id:'fire',name:'Boule de Feu',type:'mag',desc:'Sort offensif feu.',cost:0,req:[]},
    {id:'ignite',name:'Immolé',type:'debuff',desc:'Brûlure sur plusieurs tours.',cost:1,req:['fire']},
    {id:'focus',name:'Concentration',type:'passive',desc:'+10% dégâts magiques.',cost:1,req:['fire']},
    {id:'silence',name:'Silence',type:'debuff',desc:'Empêche usage compétences.',cost:2,req:['ignite']}
  ],
  Voleur: [
    {id:'stab',name:'Estoc',type:'phys',desc:'Attaque critique.',cost:0,req:[]},
    {id:'steal',name:'Vol',type:'utility',desc:'Vole objet/or.',cost:1,req:['stab']},
    {id:'evasion',name:'Evasion',type:'passive',desc:'+8 esquive.',cost:1,req:['stab']},
    {id:'assassin',name:'Assassinat',type:'phys',desc:'Très gros dégât si ennemi isolé.',cost:2,req:['steal','evasion']}
  ]
};

// --- Shop items --------------------------------------------------------------
const SHOP_ITEMS = [
  {id:'iron_sword', name:'Épée de fer', slot:'Arme', rarity:'Commun', stats:{atk:3,spd:0}, price:45},
  {id:'steel_sword', name:'Épée d\'acier', slot:'Arme', rarity:'Rare', stats:{atk:7,spd:0}, price:180},
  {id:'leather_armor', name:'Armure en cuir', slot:'Armure', rarity:'Commun', stats:{def:2,hp:20}, price:40},
  {id:'mystic_robe', name:'Robe mystique', slot:'Armure', rarity:'Épique', stats:{mag:6,mdef:4,mp:20}, price:420},
  {id:'swift_boots', name:'Bottes rapides', slot:'Bottes', rarity:'Rare', stats:{spd:3,eva:2}, price:220}
];

// --- Combat manager ------------------------------------------------------------
const Battle = {
  player: null,
  enemy: null,
  turnQueue: [],
  running:false,

  startEncounter(player, enemy){
    this.player = player; this.enemy = enemy; this.running=true;
    UI.log(`Rencontre : ${enemy.name} (Niv ${enemy.level})`);
    this.buildQueue();
    UI.showTurnOrder(this.turnQueue);
    UI.updateAll();
  },

  buildQueue(){
    this.turnQueue = [this.player, this.enemy].sort((a,b)=> b.spd - a.spd);
  },

  playerAction(action, payload){
    if(!this.running) return;
    if(action==='attack'){
      const res = calcPhysicalDamage(this.player, this.enemy, 1.0);
      if(!res.hit) UI.log(`${this.player.name} rate son attaque.`);
      else {
        this.enemy.hp -= res.dmg; UI.log(`${this.player.name} inflige ${res.dmg} (${res.crit? 'CRIT':''}) à ${this.enemy.name}`);
      }
    } else if(action==='skill'){
      const skill = this.player.skills.find(s=>s.id===payload);
      if(!skill){ UI.log('Compétence introuvable'); }
      else if(skill.type==='phys'){
        const r = calcPhysicalDamage(this.player,this.enemy,skill.power);
        if(!r.hit) UI.log(`${this.player.name} rate ${skill.name}.`);
        else { this.enemy.hp -= r.dmg; UI.log(`${skill.name} inflige ${r.dmg}${r.crit? ' (CRIT)':''}`); }
      } else if(skill.type==='mag'){
        if(this.player.mp < skill.cost){ UI.log('Pas assez de MP'); }
        else { this.player.mp -= skill.cost; const r = calcMagicDamage(this.player,this.enemy,skill.power); if(!r.hit) UI.log('Sort raté'); else { this.enemy.hp -= r.dmg; UI.log(`${skill.name} inflige ${r.dmg}${r.crit? ' (CRIT)':''}`); } }
      } else if(skill.type==='utility'){
        if(skill.id==='steal'){
          const stealRoll = Math.random();
          if(stealRoll < 0.4 + this.player.luck*0.01){ const item = randomEquipment(this.enemy.level,this.player.luck); UI.log(`Vol réussi : ${item.name}`); UI.addItem(item); }
          else UI.log('Vol échoué');
        }
      }
    } else if(action==='defend'){
      UI.log(`${this.player.name} se met en garde (défense augmentée pour un tour)`);
      this.player.buffs.def = (this.player.buffs.def||0) + 5;
    }

    this.resolveEndOfTurn();
  },

  enemyTurn(){
    if(!this.enemy.isAlive()) return;
    // Improved AI:
    // - respect cooldowns and MP
    // - bosses favor powerful skills below thresholds
    const available = (this.enemy.skills||[]).filter(s=>{
      if(s.cooldown && this.enemy.cooldowns[s.id] > 0) return false;
      if(s.cost && this.enemy.mp < s.cost) return false;
      return true;
    });
    let skill = null;
    const hpPct = this.enemy.hp / Math.max(1,this.enemy.maxHp);
    if(this.enemy.isBoss){
      // boss behaviour: prefer smash when below 60%, else random but weighted by power
      if(hpPct < 0.6){ skill = available.find(s=>s.id==='smash') || null; }
      if(!skill){ // fallback to highest power available
        available.sort((a,b)=> (b.power||0) - (a.power||0));
        skill = available[0] || null;
      }
    } else {
      // regular enemy: pick random available skill
      if(available.length) skill = available[Math.floor(Math.random()*available.length)];
    }

    // If no skill usable, perform basic physical attack
    if(!skill){
      const r = calcPhysicalDamage(this.enemy,this.player,1.0);
      if(!r.hit) UI.log(`${this.enemy.name} rate son attaque.`);
      else { this.player.hp -= r.dmg; UI.log(`${this.enemy.name} inflige ${r.dmg} à ${this.player.name}`); }
      return;
    }

    // Use chosen skill
    if(skill.type==='phys'){
      const r = calcPhysicalDamage(this.enemy,this.player,skill.power);
      if(!r.hit) UI.log(`${this.enemy.name} rate ${skill.name}.`);
      else { this.player.hp -= r.dmg; UI.log(`${this.enemy.name} utilise ${skill.name} et inflige ${r.dmg} à ${this.player.name}`); }
    } else if(skill.type==='mag'){
      if(this.enemy.mp >= (skill.cost||0)){
        this.enemy.mp -= (skill.cost||0);
        const r = calcMagicDamage(this.enemy,this.player,skill.power);
        if(!r.hit) UI.log(`${this.enemy.name} rate ${skill.name}.`);
        else { this.player.hp -= r.dmg; UI.log(`${this.enemy.name} utilise ${skill.name} et inflige ${r.dmg} à ${this.player.name}`); }
      } else {
        UI.log(`${this.enemy.name} tente ${skill.name} mais manque de MP.`);
      }
    }

    // set cooldown if applicable
    if(skill.cooldown){ this.enemy.cooldowns[skill.id] = skill.cooldown; }
  },

  reduceCooldowns(){
    if(!this.enemy || !this.enemy.cooldowns) return;
    for(const k in this.enemy.cooldowns){ if(this.enemy.cooldowns[k] > 0) this.enemy.cooldowns[k] -= 1; }
  },

  resolveEndOfTurn(){
    // Check deaths
    if(this.enemy.hp <=0){
      UI.log(`${this.enemy.name} vaincu !`);
      this.awardLootAndXP();
      this.running=false; UI.updateAll(); return;
    }
    if(this.player.hp <=0){
      UI.log(`${this.player.name} est tombé... Fin de la partie.`);
      this.running=false; UI.updateAll(); return;
    }

    // Enemy acts
    this.enemyTurn();

    if(this.player.hp <=0){ UI.log(`${this.player.name} est tombé...`); this.running=false; UI.updateAll(); return; }
    // Next round: rebuild queue
    this.reduceCooldowns();
    this.buildQueue(); UI.showTurnOrder(this.turnQueue); UI.updateAll();
  },

  awardLootAndXP(){
    const xpGain = Math.floor(20 * this.enemy.level * 1.2);
    UI.log(`+${xpGain} XP gagnés.`);
    this.player.gainXP(xpGain);
    // loot and gold
    const drops = [];
    if(Math.random() < CONFIG.DROP_BASE + this.player.luck*0.01){ const item = randomEquipment(this.enemy.level,this.player.luck); UI.log(`Objet trouvé : ${item.name}`); UI.addItem(item); drops.push(item); }
    const gold = Math.floor(5 * this.enemy.level * (1 + Math.random()*0.5));
    this.player.gold += gold;
    UI.log(`+${gold} or gagnés.`);
    // show end of combat summary
    UI.showCombatEnd({xp:xpGain, gold:gold, items:drops, enemy:this.enemy});
  }
}

// --- UI glue ------------------------------------------------------------------
const UI = {
  init(){
    this.bind();
    // create a default player
    // expose UI globally for inline handlers
    window.UI = this;
    window.player = new Player('Aldo','Guerrier');
    window.player.xp = 0;
    window.player.xpNext = xpNeededFor(2);
    window.player.unlockedSkills = ['slash'];
    window.inventory = [];
    this.updateAll();
    // quick start encounter button for testing
    setTimeout(()=>{ const e = new Enemy('gobelin',2); Battle.startEncounter(window.player,e); }, 300);
  },
  bind(){
    document.getElementById('btn-attack').addEventListener('click',()=>{ Battle.playerAction('attack'); });
    document.getElementById('btn-defend').addEventListener('click',()=>{ Battle.playerAction('defend'); });
    document.getElementById('btn-skill').addEventListener('click',()=>{ this.showSkillList(); });
    document.getElementById('open-skills').addEventListener('click',()=>{ this.openSkillTree(); });
    document.getElementById('open-shop').addEventListener('click',()=>{ this.openShop(); });
    // modal controls
    const closeSkill = document.getElementById('close-skilltree'); if(closeSkill) closeSkill.addEventListener('click',()=>{ document.getElementById('modal-skilltree').classList.add('hidden'); });
    const closeShop = document.getElementById('close-shop'); if(closeShop) closeShop.addEventListener('click',()=>{ document.getElementById('modal-shop').classList.add('hidden'); });
    const cont = document.getElementById('btn-continue'); if(cont) cont.addEventListener('click',()=>{ document.getElementById('modal-combat-end').classList.add('hidden'); });
  },
  log(txt){
    const el = document.getElementById('log');
    const line = document.createElement('div'); line.textContent = txt; el.prepend(line);
  },
  updateAll(){
    this.updatePlayer(); this.updateEnemy();
  },
  updatePlayer(){
    const p = window.player;
    document.getElementById('player-name').textContent = `${p.name} (Niv ${p.level})`;
    const st = document.getElementById('player-stats');
    st.innerHTML = `
      <div><span class="stat-label">PV</span>: ${p.hp}/${p.maxHp}</div>
      <div><span class="stat-label">MP</span>: ${p.mp}/${p.maxMp}</div>
      <div><span class="stat-label">ATK</span>: ${p.atk}  <span class="stat-label">DEF</span>: ${p.def}</div>
      <div><span class="stat-label">MAG</span>: ${p.mag}  <span class="stat-label">MDEF</span>: ${p.mdef}</div>
      <div><span class="stat-label">SPD</span>: ${p.spd}  <span class="stat-label">CRIT</span>: ${p.critRate}%</div>
      <div><span class="stat-label">PRÉC</span>: ${p.acc}  <span class="stat-label">ESQ</span>: ${p.eva}</div>
      <div><span class="stat-label">CHANCE</span>: ${p.luck}</div>
    `;
    document.getElementById('player-xp').textContent = `XP: ${p.xp}/${xpNeededFor(p.level+1)}`;
    // equipment container (will be filled below)
    const eq = document.getElementById('player-equipment');
    eq.innerHTML = '';
    // inventory (with equip buttons)
    const inv = document.getElementById('inventory'); inv.innerHTML='';
    window.inventory.slice(0,20).forEach((it,idx)=>{
      const row = document.createElement('div'); row.className='inv-item';
      const left = document.createElement('div'); left.textContent = `${it.name} (${it.rarity})`;
      const right = document.createElement('div');
      const btn = document.createElement('button'); btn.className='btn-equip'; btn.textContent='Equiper'; btn.onclick = ()=>{ this.equipItem(idx); };
      right.appendChild(btn);
      row.appendChild(left); row.appendChild(right); inv.appendChild(row);
    });

    // equipment slots with unequip buttons
    const eqSlots = Object.keys(p.equipment).length ? Object.keys(p.equipment) : ['Arme','Armure','Casque','Bottes','Accessoire'];
    eq.innerHTML = '<strong>Équipement</strong>';
    eqSlots.forEach(slot=>{
      const item = p.equipment[slot];
      const div = document.createElement('div'); div.className='equip-slot';
      if(item){ div.innerHTML = `${slot}: ${item.name} <button class="btn-equip" onclick="window.UI.unequipSlot('${slot}')">Déséquiper</button>`; }
      else { div.textContent = `${slot}: (vide)`; }
      eq.appendChild(div);
    });
    const gold = document.createElement('div'); gold.className='player-gold'; gold.textContent = `Or: ${p.gold}`; eq.appendChild(gold);
  },
  showTurnOrder(queue){
    const el = document.getElementById('log'); const line = document.createElement('div'); line.textContent = 'Ordre de tour: ' + queue.map(x=>x.name).join(' > '); el.prepend(line);
  },
  updateEnemy(){
    const en = Battle.enemy;
    if(!en){ document.getElementById('enemy-name').textContent='Aucun ennemi'; document.getElementById('enemy-stats').innerHTML=''; return; }
    document.getElementById('enemy-name').textContent = `${en.name} (Niv ${en.level})`;
    document.getElementById('enemy-stats').innerHTML = `
      <div><span class="stat-label">PV</span>: ${en.hp}/${en.maxHp}</div>
      <div><span class="stat-label">ATK</span>: ${en.atk}  <span class="stat-label">DEF</span>: ${en.def}</div>
      <div><span class="stat-label">SPD</span>: ${en.spd}</div>
    `;
  },
  showSkillList(){
    const panel = document.getElementById('skill-select'); panel.innerHTML=''; panel.classList.remove('hidden');
    window.player.skills.forEach(s=>{ const d = document.createElement('div'); d.className='skill'; d.textContent = `${s.name} — ${s.desc || ''}`; d.onclick=()=>{ Battle.playerAction('skill', s.id); panel.classList.add('hidden'); }; panel.appendChild(d); });
  },
  addItem(item){ window.inventory.push(item); this.updatePlayer(); }

  // Skill tree UI
  ,openSkillTree(){
    const modal = document.getElementById('modal-skilltree'); modal.classList.remove('hidden');
    const container = document.getElementById('skill-tree-container'); container.innerHTML='';
    const tree = SKILL_TREES[window.player.cls] || [];
    tree.forEach(node=>{
      const div = document.createElement('div'); div.className='skill-node';
      const locked = !this.canUnlock(node.id);
      if(locked) div.classList.add('locked'); else if(window.player.unlockedSkills.includes(node.id)) div.classList.add('unlocked');
      div.innerHTML = `<strong>${node.name}</strong><div class="meta">${node.desc}</div><div class="meta">Coût: ${node.cost}</div>`;
      div.onclick = ()=>{ if(window.player.unlockedSkills.includes(node.id)) return; if(this.canUnlock(node.id)){ if(window.player.skillPoints >= node.cost){ window.player.skillPoints -= node.cost; window.player.unlockedSkills.push(node.id); const skillDef = {id:node.id,name:node.name,type:node.type,power:node.power||1,cost:node.cost||0,desc:node.desc}; window.player.skills.push(skillDef); UI.log(`Compétence débloquée: ${node.name}`); this.updateAll(); this.openSkillTree(); } else { alert('Pas assez de points de compétence.'); } } else { alert('Conditions non remplies pour débloquer.'); } };
      container.appendChild(div);
    });
  }

  ,canUnlock(skillId){
    const tree = SKILL_TREES[window.player.cls] || [];
    const node = tree.find(n=>n.id===skillId);
    if(!node) return false;
    if(window.player.unlockedSkills.includes(skillId)) return false;
    for(const req of node.req){ if(!window.player.unlockedSkills.includes(req)) return false; }
    return true;
  }

  // Shop
  ,openShop(){
    const modal = document.getElementById('modal-shop'); modal.classList.remove('hidden');
    const list = document.getElementById('shop-list'); list.innerHTML='';
    SHOP_ITEMS.forEach(it=>{
      const row = document.createElement('div'); row.className='shop-item';
      row.innerHTML = `<div><strong>${it.name}</strong><div class="meta">${it.slot} • ${it.rarity} • +${Object.entries(it.stats).map(s=>s[0]+':'+s[1]).join(', ')}</div></div>`;
      const right = document.createElement('div'); const btn = document.createElement('button'); btn.className='btn-buy'; btn.textContent = `Acheter (${it.price}g)`; btn.onclick = ()=>{ this.buyItem(it.id); };
      right.appendChild(btn); row.appendChild(right); list.appendChild(row);
    });
  }

  ,buyItem(id){
    const it = SHOP_ITEMS.find(x=>x.id===id); if(!it) return; if(window.player.gold < it.price){ alert('Pas assez d\'or'); return; }
    window.player.gold -= it.price; const item = JSON.parse(JSON.stringify(it)); delete item.price; window.inventory.push(item);
    // auto-equip if slot free
    if(!window.player.equipment[it.slot]){ window.player.equipment[it.slot] = item; for(const k in item.stats){ if(k in window.player) window.player[k] += item.stats[k]; } }
    UI.log(`Acheté: ${it.name}`); this.updateAll();
  }

  ,showCombatEnd(results){
    const modal = document.getElementById('modal-combat-end'); modal.classList.remove('hidden');
    const container = document.getElementById('combat-results'); container.innerHTML = '';
    const xp = document.createElement('div'); xp.textContent = `XP gagnée: ${results.xp}`; container.appendChild(xp);
    const g = document.createElement('div'); g.textContent = `Or gagné: ${results.gold}`; container.appendChild(g);
    const en = document.createElement('div'); en.textContent = `Ennemi vaincu: ${results.enemy.name}`; container.appendChild(en);
    if(results.items && results.items.length){ const ul = document.createElement('div'); ul.innerHTML = '<strong>Objets:</strong>'; results.items.forEach(i=>{ const d = document.createElement('div'); d.textContent = `${i.name} (${i.rarity})`; ul.appendChild(d); }); container.appendChild(ul); }
  }

  ,equipItem(idx){
    const it = window.inventory[idx]; if(!it) return; // take from inventory
    // remove from inventory (first occurrence)
    window.inventory.splice(idx,1);
    // if slot occupied, unequip first
    const slot = it.slot;
    if(window.player.equipment[slot]){
      // move old to inventory and remove stats
      const old = window.player.equipment[slot]; window.inventory.push(old);
      for(const k in old.stats){ if(k in window.player){ if(k==='hp'){ window.player.maxHp -= old.stats[k]; window.player.hp = Math.min(window.player.hp, window.player.maxHp); } else if(k==='mp'){ window.player.maxMp -= old.stats[k]; window.player.mp = Math.min(window.player.mp, window.player.maxMp); } else { window.player[k] -= old.stats[k]; } } }
    }
    // equip new
    window.player.equipment[slot] = it;
    for(const k in it.stats){ if(k in window.player){ if(k==='hp'){ window.player.maxHp += it.stats[k]; window.player.hp += it.stats[k]; } else if(k==='mp'){ window.player.maxMp += it.stats[k]; window.player.mp += it.stats[k]; } else { window.player[k] += it.stats[k]; } } }
    UI.log(`Équipé: ${it.name}`);
    this.updateAll();
  }

  ,unequipSlot(slot){
    const item = window.player.equipment[slot]; if(!item) return; delete window.player.equipment[slot];
    // remove stats
    for(const k in item.stats){ if(k in window.player){ if(k==='hp'){ window.player.maxHp -= item.stats[k]; window.player.hp = Math.min(window.player.hp, window.player.maxHp); } else if(k==='mp'){ window.player.maxMp -= item.stats[k]; window.player.mp = Math.min(window.player.mp, window.player.maxMp); } else { window.player[k] -= item.stats[k]; } } }
    window.inventory.push(item);
    UI.log(`Déséquipé: ${item.name}`);
    this.updateAll();
  }
};

// --- Démarrage ----------------------------------------------------------------
window.addEventListener('DOMContentLoaded', ()=>{ UI.init(); });
