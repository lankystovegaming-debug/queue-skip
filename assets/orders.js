/* Validate legacy local and database receipts. Card details are never included. */
window.demoOrders = {
  create(draft, id, createdAt) {
    const items = draft.items.map(item => ({
      stall:item.stall, unit:item.unit, name:item.name,
      quantity:item.quantity, price:item.price
    }));
    return {
      version:1, source:draft.source==='database'?'database':'local', id, createdAt, studentName:draft.studentName,
      studentClass:draft.studentClass, pickupDate:draft.pickupDate,
      pickupTime:draft.pickupTime, notes:draft.notes,
      paymentMethod:draft.paymentMethod,
      lastFour:draft.paymentMethod==='online'?draft.lastFour:'',
      items, total:items.reduce((sum,item)=>sum+item.price*item.quantity,0)
    };
  },
  parseHistory(raw) {
    try {
      const entries=JSON.parse(raw);
      if(!Array.isArray(entries)) return [];
      const seen=new Set();
      return entries.map(entry=>this.parse(JSON.stringify(entry))).filter(order=>{
        if(!order || seen.has(order.id)) return false;
        seen.add(order.id); return true;
      });
    } catch { return []; }
  },
  parse(raw) {
    try {
      const order=JSON.parse(raw);
      const text=(value,max)=>typeof value==='string' && value.length<=max;
      if(!order || order.version!==1 || !/^QS-(?:DEMO-[A-Z0-9]{8}|[A-Z0-9]{12})$/.test(order.id) ||
        !Number.isFinite(Date.parse(order.createdAt)) ||
        !text(order.studentName,70) || !order.studentName.trim() ||
        !text(order.studentClass,30) || !order.studentClass.trim() || !text(order.notes,300) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(order.pickupDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(order.pickupTime) ||
        !Number.isFinite(Date.parse(`${order.pickupDate}T${order.pickupTime}:00+08:00`)) ||
        !['pickup','online'].includes(order.paymentMethod) ||
        (order.paymentMethod==='online' && !/^\d{4}$/.test(order.lastFour) && !(order.source==='database' && order.lastFour==='')) ||
        !Array.isArray(order.items) || !order.items.length || order.items.length>100) return null;
      for(const item of order.items) {
        if(!item || !text(item.stall,100) || !text(item.name,100) || !text(item.unit,10) ||
          !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>99 ||
          !Number.isSafeInteger(item.price) || item.price<0 || item.price>100000) return null;
      }
      const clean=this.create(order,order.id,order.createdAt);
      return clean.total===order.total?clean:null;
    } catch { return null; }
  }
};
